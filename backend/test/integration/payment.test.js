const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database');
const schema = `pay_test_${crypto.randomBytes(8).toString('hex')}`;
const url = new URL(process.env.TEST_DATABASE_URL);
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.JWT_ISSUER = 'fitkitchen';
process.env.JWT_AUDIENCE = 'fitkitchen-api';
const HASH_SECRET = crypto.randomBytes(16).toString('hex').toUpperCase();
const VNP_ENV = {
    VNP_TMN_CODE: 'TESTTMN1',
    VNP_HASH_SECRET: HASH_SECRET,
    VNP_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    VNP_RETURN_URL: 'http://localhost:3000/api/payments/vnpay/return',
    PAYMENT_RESULT_URL: 'http://localhost:5173/payment/result'
};
Object.assign(process.env, VNP_ENV);

const root = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const pool = require('../../src/config/database');
const app = require('../../src/app');
const vnpay = require('../../src/modules/payment/vnpay');

test('VNPay online payment against PostgreSQL', async t => {
    let server;
    await root.query(`CREATE SCHEMA ${schema}`);
    t.after(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        await pool.end();
        await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await root.end();
    });

    const sql = file => fs.readFile(path.join(__dirname, '../../db', file), 'utf8');
    for (const file of [
        'init/01_schema.sql',
        'init/02_mockdata.sql',
        'init/03_admin_customers.sql',
        'migrations/001_admin_customers.sql',
        'migrations/002_catalog_goal_macros.sql',
        'migrations/003_auth_sessions.sql',
        'migrations/004_subscriptions.sql',
        'migrations/005_nutrition_profiles.sql',
        'migrations/006_payment_transactions.sql',
        'migrations/007_promotions.sql'
    ]) {
        await pool.query(await sql(file));
    }

    await t.test('payment schema files are repeatable', async () => {
        await pool.query(await sql('migrations/006_payment_transactions.sql'));
        await pool.query(await sql('init/06_payment_transactions.sql'));
        await pool.query(await sql('migrations/007_promotions.sql'));
        await pool.query(await sql('init/07_promotions.sql'));
    });

    const { rows: [admin, customer, other] } = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, phone, role)
         VALUES ('pay-admin@example.test', 'unused', 'Pay Admin', '0900000200', 'ADMIN'),
                ('pay-cust1@example.test', 'unused', 'Pay Customer One', '0900000201', 'CUSTOMER'),
                ('pay-cust2@example.test', 'unused', 'Pay Customer Two', '0900000202', 'CUSTOMER')
         RETURNING id`
    );
    const { rows: [address, otherAddress] } = await pool.query(
        `INSERT INTO user_addresses (user_id, recipient_name, phone, address_detail, is_default)
         VALUES ($1, 'Pay Customer One', '0900000201', '1 Le Loi, District 1, HCMC', TRUE),
                ($2, 'Pay Customer Two', '0900000202', '2 Pasteur, District 3, HCMC', TRUE)
         RETURNING id`,
        [customer.id, other.id]
    );
    const { rows: [meal] } = await pool.query(
        "SELECT id, price FROM meals WHERE is_available = TRUE AND meal_type = 'SINGLE' ORDER BY id LIMIT 1"
    );

    const sign = user => jwt.sign({}, process.env.JWT_SECRET, {
        subject: String(user.id), issuer: 'fitkitchen', audience: 'fitkitchen-api', expiresIn: '15m'
    });
    const adminToken = sign(admin);
    const customerToken = sign(customer);
    const otherToken = sign(other);

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const base = `${origin}/api`;

    async function request(route, { method = 'GET', token = null, body } = {}) {
        const res = await fetch(base + route, {
            method,
            redirect: 'manual',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        });
        const type = res.headers.get('content-type') || '';
        return {
            status: res.status,
            location: res.headers.get('location'),
            body: type.includes('json') ? await res.json() : null
        };
    }

    const today = new Date().toISOString().slice(0, 10);
    async function placeOrder(token, addressId, paymentMethod) {
        const added = await request('/cart/items', { method: 'POST', token, body: { meal_id: String(meal.id), quantity: 2 } });
        assert.equal(added.status, 201);
        const res = await request('/orders/checkout', {
            method: 'POST',
            token,
            body: { address_id: String(addressId), delivery_date: today, delivery_time_slot: '11:00 - 12:00', payment_method: paymentMethod }
        });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        return res.body.data;
    }

    const attempts = async orderId => (await pool.query(
        'SELECT * FROM payment_transactions WHERE order_id = $1 ORDER BY id', [orderId]
    )).rows;
    const orderRow = async orderId => (await pool.query(
        'SELECT status, payment_method, payment_status FROM customer_orders WHERE id = $1', [orderId]
    )).rows[0];

    function ipnQuery(attempt, overrides = {}) {
        const params = {
            vnp_TmnCode: VNP_ENV.VNP_TMN_CODE,
            vnp_Amount: String(attempt.amount),
            vnp_BankCode: 'NCB',
            vnp_BankTranNo: 'VNP15000001',
            vnp_CardType: 'ATM',
            vnp_OrderInfo: `Thanh toan don hang ${attempt.order_id}`,
            vnp_PayDate: '20261126103000',
            vnp_ResponseCode: '00',
            vnp_TransactionNo: '15000001',
            vnp_TransactionStatus: '00',
            vnp_TxnRef: attempt.txn_ref,
            ...overrides
        };
        return { ...params, vnp_SecureHash: vnpay.sign(params, HASH_SECRET) };
    }
    const ipn = query => request(`/payments/vnpay/ipn?${new URLSearchParams(query)}`);

    // Silences the expected duplicate/cancelled payment warnings.
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = message => warnings.push(message);
    t.after(() => { console.warn = originalWarn; });

    await t.test('promotion validation, Admin management and checkout snapshots use server totals', async () => {
        const created = await request('/admin/promotions', {
            method: 'POST',
            token: adminToken,
            body: {
                code: 'save10',
                description: 'Ten percent off',
                discount_type: 'PERCENTAGE',
                discount_value: 10,
                min_order_amount: 0,
                max_discount_amount: 10000,
                start_date: null,
                end_date: null,
                usage_limit: 10,
                per_user_limit: 1,
                is_active: true
            }
        });
        assert.equal(created.status, 201);
        assert.equal(created.body.data.code, 'SAVE10');
        assert.equal((await request('/admin/promotions')).status, 401);
        assert.equal((await request('/admin/promotions', { token: customerToken })).status, 403);
        assert.equal((await request('/admin/promotions', adminToken)).body.data[0].redemption_count, 0);

        await request('/cart/items', {
            method: 'POST', token: customerToken,
            body: { meal_id: String(meal.id), quantity: 2 }
        });
        const cart = (await request('/cart', { token: customerToken })).body.data;
        const preview = await request('/promotions/validate', {
            method: 'POST', token: customerToken, body: { code: 'save10' }
        });
        assert.equal(preview.status, 200);
        assert.equal(preview.body.data.code, 'SAVE10');
        assert.equal(preview.body.data.subtotal, Number(cart.subtotal));
        assert.equal(preview.body.data.discount_amount, Math.min(Number(cart.subtotal) * 0.1, 10000));
        assert.equal((await request('/promotions/validate', { method: 'POST', body: { code: 'SAVE10' } })).status, 401);
        assert.equal((await request('/promotions/validate', {
            method: 'POST', token: customerToken, body: { code: 'MISSING' }
        })).body.code, 'PROMOTION_UNAVAILABLE');

        const checkout = await request('/orders/checkout', {
            method: 'POST',
            token: customerToken,
            body: {
                address_id: String(address.id),
                delivery_date: today,
                payment_method: 'ONLINE',
                promotion_code: 'save10'
            }
        });
        assert.equal(checkout.status, 201, JSON.stringify(checkout.body));
        const order = checkout.body.data;
        assert.equal(order.promotion_code, 'SAVE10');
        assert.equal(Number(order.subtotal_amount), preview.body.data.subtotal);
        assert.equal(Number(order.discount_amount), preview.body.data.discount_amount);
        assert.equal(Number(order.total_amount), preview.body.data.total_amount);
        const paymentUrl = new URL(order.payment.redirect_url);
        assert.equal(paymentUrl.searchParams.get('vnp_Amount'), String(Math.round(order.total_amount * 100)));

        await request('/cart/items', {
            method: 'POST', token: customerToken,
            body: { meal_id: String(meal.id), quantity: 1 }
        });
        const exhausted = await request('/promotions/validate', {
            method: 'POST', token: customerToken, body: { code: 'SAVE10' }
        });
        assert.equal(exhausted.body.code, 'PROMOTION_LIMIT_REACHED');
        const disabled = await request(`/admin/promotions/${created.body.data.id}`, {
            method: 'PATCH', token: adminToken, body: { is_active: false }
        });
        assert.equal(disabled.status, 200);
        assert.equal(disabled.body.data.is_active, false);
    });

    let order;
    let firstUrl;
    await t.test('ONLINE checkout returns a signed VNPay URL with every required parameter', async () => {
        order = await placeOrder(customerToken, address.id, 'ONLINE');
        assert.equal(order.payment_method, 'ONLINE');
        assert.equal(order.payment.provider, 'VNPAY');
        firstUrl = new URL(order.payment.redirect_url);
        assert.equal(`${firstUrl.origin}${firstUrl.pathname}`, VNP_ENV.VNP_URL);
        const query = Object.fromEntries(firstUrl.searchParams);
        assert.equal(vnpay.verify(query, HASH_SECRET), true);
        assert.equal(query.vnp_Version, '2.1.0');
        assert.equal(query.vnp_Command, 'pay');
        assert.equal(query.vnp_TmnCode, VNP_ENV.VNP_TMN_CODE);
        assert.equal(query.vnp_Amount, String(Math.round(Number(order.total_amount) * 100)));
        assert.equal(query.vnp_CurrCode, 'VND');
        assert.equal(query.vnp_OrderInfo, `Thanh toan don hang ${order.id}`);
        assert.equal(query.vnp_OrderType, 'other');
        assert.equal(query.vnp_Locale, 'vn');
        assert.equal(query.vnp_ReturnUrl, VNP_ENV.VNP_RETURN_URL);
        assert.equal(query.vnp_IpAddr, '127.0.0.1');
        assert.match(query.vnp_CreateDate, /^\d{14}$/);
        assert.match(query.vnp_ExpireDate, /^\d{14}$/);
        assert.equal(query.vnp_TxnRef, `${order.id}A1T${query.vnp_CreateDate}`);

        const rows = await attempts(order.id);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].status, 'PENDING');
        assert.equal(rows[0].amount, query.vnp_Amount);
        assert.equal(rows[0].vnp_create_date, query.vnp_CreateDate);
    });

    await t.test('creating the URL again reuses the unexpired attempt, also under concurrency', async () => {
        const again = await request('/payments/vnpay', { method: 'POST', token: customerToken, body: { order_id: order.id } });
        assert.equal(again.status, 200);
        assert.equal(again.body.data.redirect_url, firstUrl.toString());

        const parallel = await Promise.all([1, 2, 3].map(() =>
            request('/payments/vnpay', { method: 'POST', token: customerToken, body: { order_id: order.id } })));
        for (const res of parallel) assert.equal(res.body.data.redirect_url, firstUrl.toString());
        assert.equal((await attempts(order.id)).length, 1);

        const fresh = await placeOrder(customerToken, address.id, 'ONLINE');
        await pool.query('DELETE FROM payment_transactions WHERE order_id = $1', [fresh.id]);
        const racing = await Promise.all([1, 2, 3].map(() =>
            request('/payments/vnpay', { method: 'POST', token: customerToken, body: { order_id: fresh.id } })));
        assert.ok(racing.every(res => res.status === 200));
        assert.equal(new Set(racing.map(res => res.body.data.txn_ref)).size, 1);
        assert.equal((await attempts(fresh.id)).length, 1);
    });

    let expiredAttempt;
    await t.test('an expired attempt produces a new txn_ref', async () => {
        [expiredAttempt] = await attempts(order.id);
        await pool.query(
            "UPDATE payment_transactions SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute', vnp_create_date = '20260101000000', txn_ref = $2 WHERE id = $1",
            [expiredAttempt.id, `${order.id}A1T20260101000000`]
        );
        const res = await request('/payments/vnpay', { method: 'POST', token: customerToken, body: { order_id: order.id } });
        assert.equal(res.status, 200);
        assert.notEqual(res.body.data.txn_ref, `${order.id}A1T20260101000000`);
        const rows = await attempts(order.id);
        assert.equal(rows.length, 2);
        assert.ok(rows.every(row => row.status === 'PENDING'));
        expiredAttempt = rows[0];
    });

    await t.test('URL creation rejects anonymous, foreign, COD and malformed requests', async () => {
        assert.equal((await request('/payments/vnpay', { method: 'POST', body: { order_id: order.id } })).status, 401);
        const foreign = await request('/payments/vnpay', { method: 'POST', token: otherToken, body: { order_id: order.id } });
        assert.equal(foreign.status, 404);
        assert.equal(foreign.body.code, 'ORDER_NOT_FOUND');
        const cod = await placeOrder(otherToken, otherAddress.id, 'COD');
        assert.equal(cod.payment, undefined);
        const codPay = await request('/payments/vnpay', { method: 'POST', token: otherToken, body: { order_id: cod.id } });
        assert.equal(codPay.status, 409);
        assert.equal(codPay.body.code, 'PAYMENT_NOT_ALLOWED');
        const bad = await request('/payments/vnpay', { method: 'POST', token: customerToken, body: { order_id: 'x', amount: 1 } });
        assert.equal(bad.status, 400);
    });

    await t.test('IPN rejects bad checksum (97), unknown txn (01) and wrong amount (04) without changes', async () => {
        const [, current] = await attempts(order.id);
        const tampered = { ...ipnQuery(current), vnp_Amount: '1' };
        assert.deepEqual((await ipn(tampered)).body, { RspCode: '97', Message: 'Invalid Checksum' });
        assert.equal((await ipn({ ...ipnQuery(current), vnp_SecureHash: 'short' })).body.RspCode, '97');
        assert.equal((await ipn(ipnQuery({ ...current, txn_ref: '999999A1T20260101000000' }))).body.RspCode, '01');
        assert.equal((await ipn(ipnQuery({ ...current, amount: '100' }))).body.RspCode, '04');
        assert.equal((await orderRow(order.id)).payment_status, 'PENDING');
        assert.equal((await attempts(order.id))[1].status, 'PENDING');
    });

    await t.test('successful IPN marks the order PAID once; repeats answer 02', async () => {
        const [, current] = await attempts(order.id);
        const res = await ipn(ipnQuery(current));
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { RspCode: '00', Message: 'Confirm Success' });
        const row = await orderRow(order.id);
        assert.equal(row.payment_status, 'PAID');
        assert.equal(row.status, 'PENDING');
        const [, saved] = await attempts(order.id);
        assert.equal(saved.status, 'SUCCESS');
        assert.equal(saved.vnp_transaction_no, '15000001');
        assert.equal(saved.bank_code, 'NCB');
        assert.equal(saved.pay_date, '20261126103000');
        assert.equal(saved.raw_data.vnp_SecureHash, undefined);
        assert.equal(saved.raw_data.vnp_TxnRef, current.txn_ref);

        const replay = await ipn(ipnQuery(current));
        assert.deepEqual(replay.body, { RspCode: '02', Message: 'Order already confirmed' });
        const concurrent = await Promise.all([1, 2].map(() => ipn(ipnQuery(current))));
        assert.ok(concurrent.every(r => r.body.RspCode === '02'));
    });

    await t.test('an older attempt paid after the order is PAID answers 02 and warns for manual refund', async () => {
        const res = await ipn(ipnQuery(expiredAttempt));
        assert.equal(res.body.RspCode, '02');
        const [old] = await attempts(order.id);
        assert.equal(old.status, 'SUCCESS');
        assert.ok(warnings.some(message => message.includes(`order ${order.id}`) && message.includes('refund manually')));
        assert.ok(warnings.every(message => !message.includes(HASH_SECRET)));
    });

    await t.test('a paid order cannot get a new URL or be self-cancelled', async () => {
        const pay = await request('/payments/vnpay', { method: 'POST', token: customerToken, body: { order_id: order.id } });
        assert.equal(pay.status, 409);
        assert.equal(pay.body.code, 'PAYMENT_NOT_ALLOWED');
        const cancel = await request(`/orders/${order.id}/cancel`, { method: 'PATCH', token: customerToken });
        assert.equal(cancel.status, 409);
        assert.equal(cancel.body.code, 'ORDER_PAID');
    });

    let failedOrder;
    await t.test('a failed IPN marks FAILED and the customer can create a new attempt', async () => {
        failedOrder = await placeOrder(customerToken, address.id, 'ONLINE');
        const [attempt] = await attempts(failedOrder.id);
        const res = await ipn(ipnQuery(attempt, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }));
        assert.equal(res.body.RspCode, '00');
        assert.equal((await orderRow(failedOrder.id)).payment_status, 'FAILED');
        assert.equal((await attempts(failedOrder.id))[0].status, 'FAILED');

        const retry = await request('/payments/vnpay', { method: 'POST', token: customerToken, body: { order_id: failedOrder.id } });
        assert.equal(retry.status, 200);
        assert.notEqual(retry.body.data.txn_ref, attempt.txn_ref);
        assert.equal((await attempts(failedOrder.id)).length, 2);
    });

    await t.test('return redirects to the configured result page and never changes the database', async () => {
        const [, pending] = await attempts(failedOrder.id);
        const before = await orderRow(failedOrder.id);
        const success = await request(`/payments/vnpay/return?${new URLSearchParams(ipnQuery(pending))}`);
        assert.equal(success.status, 302);
        const location = new URL(success.location);
        assert.equal(`${location.origin}${location.pathname}`, VNP_ENV.PAYMENT_RESULT_URL);
        assert.equal(location.searchParams.get('order_id'), String(failedOrder.id));
        assert.equal(location.searchParams.get('result'), 'success');
        assert.deepEqual(await orderRow(failedOrder.id), before);
        assert.equal((await attempts(failedOrder.id))[1].status, 'PENDING');

        const failed = await request(`/payments/vnpay/return?${new URLSearchParams(ipnQuery(pending, { vnp_ResponseCode: '24' }))}`);
        assert.equal(new URL(failed.location).searchParams.get('result'), 'failed');
        const invalid = await request(`/payments/vnpay/return?${new URLSearchParams({ ...ipnQuery(pending), vnp_ResponseCode: '01' })}`);
        assert.equal(new URL(invalid.location).searchParams.get('result'), 'invalid');
    });

    await t.test('payment status API returns the real state of the customer\'s own order only', async () => {
        const own = await request(`/payments/orders/${order.id}`, { token: customerToken });
        assert.equal(own.status, 200);
        assert.equal(own.body.data.payment_status, 'PAID');
        assert.equal(own.body.data.can_retry, false);
        assert.equal(own.body.data.latest_transaction.status, 'SUCCESS');

        const failed = await request(`/payments/orders/${failedOrder.id}`, { token: customerToken });
        assert.equal(failed.body.data.payment_status, 'FAILED');
        assert.equal(failed.body.data.can_retry, true);

        assert.equal((await request(`/payments/orders/${order.id}`, { token: otherToken })).status, 404);
        assert.equal((await request(`/payments/orders/${order.id}`)).status, 401);
    });

    await t.test('Admin cannot prepare an unpaid ONLINE order; paid ONLINE and COD orders proceed', async () => {
        const unpaid = await request(`/admin/orders/${failedOrder.id}/status`, {
            method: 'PATCH', token: adminToken, body: { status: 'PREPARING', expected_status: 'PENDING' }
        });
        assert.equal(unpaid.status, 409);
        assert.equal(unpaid.body.code, 'PAYMENT_REQUIRED');
        assert.equal((await orderRow(failedOrder.id)).status, 'PENDING');

        const cancel = await request(`/admin/orders/${failedOrder.id}/status`, {
            method: 'PATCH', token: adminToken, body: { status: 'CANCELLED', expected_status: 'PENDING' }
        });
        assert.equal(cancel.status, 200);

        const paid = await request(`/admin/orders/${order.id}/status`, {
            method: 'PATCH', token: adminToken, body: { status: 'PREPARING', expected_status: 'PENDING' }
        });
        assert.equal(paid.status, 200);
        assert.equal(paid.body.data.status, 'PREPARING');

        const cod = await placeOrder(customerToken, address.id, 'COD');
        const codPrep = await request(`/admin/orders/${cod.id}/status`, {
            method: 'PATCH', token: adminToken, body: { status: 'PREPARING', expected_status: 'PENDING' }
        });
        assert.equal(codPrep.status, 200);
    });

    await t.test('a payment for a cancelled order is recorded and flagged for manual refund', async () => {
        const [, pending] = await attempts(failedOrder.id);
        const res = await ipn(ipnQuery(pending));
        assert.equal(res.body.RspCode, '00');
        const row = await orderRow(failedOrder.id);
        assert.equal(row.status, 'CANCELLED');
        assert.equal(row.payment_status, 'PAID');
        assert.ok(warnings.some(message => message.includes(`cancelled order ${failedOrder.id}`)));
    });

    await t.test('missing VNPay configuration: 503 for URL creation, checkout still succeeds', async () => {
        const saved = process.env.VNP_HASH_SECRET;
        delete process.env.VNP_HASH_SECRET;
        const originalError = console.error;
        console.error = () => {};
        try {
            const created = await placeOrder(customerToken, address.id, 'ONLINE');
            assert.deepEqual(created.payment, { provider: 'VNPAY', redirect_url: null });
            const res = await request('/payments/vnpay', { method: 'POST', token: customerToken, body: { order_id: created.id } });
            assert.equal(res.status, 503);
            assert.equal(res.body.code, 'PAYMENT_NOT_CONFIGURED');
            assert.equal((await ipn({ vnp_TxnRef: '1' })).body.RspCode, '99');
        } finally {
            process.env.VNP_HASH_SECRET = saved;
            console.error = originalError;
        }
    });
});

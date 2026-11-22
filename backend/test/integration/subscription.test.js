const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database');
const schema = `sub_test_${crypto.randomBytes(8).toString('hex')}`;
const url = new URL(process.env.TEST_DATABASE_URL);
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.JWT_ISSUER = 'fitkitchen';
process.env.JWT_AUDIENCE = 'fitkitchen-api';
const root = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const pool = require('../../src/config/database');
const app = require('../../src/app');

test('Subscription plans, gifts, checkout date rules and Admin management against PostgreSQL', async t => {
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
        'migrations/004_subscriptions.sql'
    ]) {
        await pool.query(await sql(file));
    }

    await t.test('migration 004 is repeatable', async () => {
        const migration = await sql('migrations/004_subscriptions.sql');
        await pool.query(migration);
        await pool.query(migration);
    });

    const { rows: [admin, customer, otherCustomer] } = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, phone, role)
         VALUES ('sub-admin@example.test', 'unused', 'Sub Admin', '0900000100', 'ADMIN'),
                ('sub-cust1@example.test', 'unused', 'Sub Customer One', '0900000101', 'CUSTOMER'),
                ('sub-cust2@example.test', 'unused', 'Sub Customer Two', '0900000102', 'CUSTOMER')
         RETURNING id, full_name, role`
    );
    const { rows: [custAddress, otherAddress] } = await pool.query(
        `INSERT INTO user_addresses (user_id, recipient_name, phone, address_detail, is_default)
         VALUES ($1, 'Sub Customer One', '0900000101', '101 Le Loi, District 1, HCMC', TRUE),
                ($2, 'Sub Customer Two', '0900000102', '202 Pasteur, District 3, HCMC', TRUE)
         RETURNING id`,
        [customer.id, otherCustomer.id]
    );

    const sign = user => jwt.sign({}, process.env.JWT_SECRET, {
        subject: String(user.id), issuer: 'fitkitchen', audience: 'fitkitchen-api', expiresIn: '15m'
    });
    const adminToken = sign(admin);
    const customerToken = sign(customer);

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`;

    async function request(route, { method = 'GET', token = null, body } = {}) {
        const res = await fetch(base + route, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        });
        return { status: res.status, body: await res.json() };
    }

    let window;
    await t.test('public subscription plans list active 7-day and 30-day plans with template gifts and checkout window', async () => {
        const res = await request('/subscription-plans');
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data.length >= 2);
        window = res.body.checkout_window;
        assert.match(window.earliest_start_date, /^\d{4}-\d{2}-\d{2}$/);
        assert.match(window.latest_start_date, /^\d{4}-\d{2}-\d{2}$/);
        const sevenDay = res.body.data.find(p => p.duration_days === 7);
        assert.ok(sevenDay);
        assert.equal(sevenDay.gifts.length, 1);
        assert.equal(sevenDay.gifts[0].quantity, 2);

        const detail = await request(`/subscription-plans/${sevenDay.id}`);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.name, sevenDay.name);
    });

    let createdPlanId;
    await t.test('Admin can create and configure a subscription plan with bundled gifts', async () => {
        const denied = await request('/admin/subscription-plans', {
            method: 'POST',
            token: customerToken,
            body: { name: 'Forbidden', duration_days: 7, meals_per_day: 2, price: 500000 }
        });
        assert.equal(denied.status, 403);

        const created = await request('/admin/subscription-plans', {
            method: 'POST',
            token: adminToken,
            body: {
                name: 'Gói Cut 7 ngày Cao Cấp',
                description: '14 bữa ăn kiểm soát calo nghiêm ngặt',
                duration_days: 7,
                meals_per_day: 2,
                price: 920000,
                is_active: true,
                gifts: [
                    { product_id: '2', gift_name: 'Tặng 2 chai Nước ép cần tây', description: 'Giao kèm ngày đầu', quantity: 2 }
                ]
            }
        });
        assert.equal(created.status, 201);
        createdPlanId = created.body.data.id;
        assert.equal(created.body.data.gifts.length, 1);
        assert.equal(created.body.data.gifts[0].product_name, 'Nước ép cần tây');
    });

    let subscriptionId;
    await t.test('Customer checkout validates start/end dates, address ownership, overlap and copies template gifts', async () => {
        // Foreign address is rejected
        const wrongAddr = await request('/subscriptions/checkout', {
            method: 'POST',
            token: customerToken,
            body: { plan_id: createdPlanId, address_id: otherAddress.id, start_date: window.earliest_start_date }
        });
        assert.equal(wrongAddr.status, 400);
        assert.equal(wrongAddr.body.code, 'ADDRESS_NOT_FOUND');

        // Past start date is rejected
        const tooEarly = await request('/subscriptions/checkout', {
            method: 'POST',
            token: customerToken,
            body: { plan_id: createdPlanId, address_id: custAddress.id, start_date: '2020-01-01' }
        });
        assert.equal(tooEarly.status, 400);
        assert.equal(tooEarly.body.code, 'INVALID_START_DATE');

        // Valid checkout succeeds, computes end_date = start_date + 6 days, and copies gifts
        const ok = await request('/subscriptions/checkout', {
            method: 'POST',
            token: customerToken,
            body: { plan_id: createdPlanId, address_id: custAddress.id, start_date: window.earliest_start_date }
        });
        assert.equal(ok.status, 201);
        subscriptionId = ok.body.data.id;
        assert.equal(ok.body.data.start_date, window.earliest_start_date);
        assert.equal(ok.body.data.status, 'PENDING');
        assert.equal(ok.body.data.total_amount, '920000.00');
        assert.equal(ok.body.data.gifts.length, 1);
        assert.equal(ok.body.data.gifts[0].gift_name, 'Tặng 2 chai Nước ép cần tây');

        // Overlapping subscription in the same date range is rejected with 409 SUBSCRIPTION_OVERLAP
        const overlap = await request('/subscriptions/checkout', {
            method: 'POST',
            token: customerToken,
            body: { plan_id: createdPlanId, address_id: custAddress.id, start_date: window.earliest_start_date }
        });
        assert.equal(overlap.status, 409);
        assert.equal(overlap.body.code, 'SUBSCRIPTION_OVERLAP');
    });

    await t.test('Admin lists customer subscriptions and transitions status and payment_status', async () => {
        const list = await request(`/admin/subscriptions?search=${encodeURIComponent('Sub Customer One')}`, {
            token: adminToken
        });
        assert.equal(list.status, 200);
        assert.equal(list.body.data.length, 1);
        assert.equal(list.body.data[0].id, subscriptionId);

        const activated = await request(`/admin/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            token: adminToken,
            body: { status: 'ACTIVE', payment_status: 'PAID' }
        });
        assert.equal(activated.status, 200);
        assert.equal(activated.body.changed, true);
        assert.equal(activated.body.data.status, 'ACTIVE');
        assert.equal(activated.body.data.payment_status, 'PAID');
    });
});

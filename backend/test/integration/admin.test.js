const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Explicit opt-in: each run owns a random schema, never public or application data.
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database');
const schema = `admin_test_${crypto.randomBytes(8).toString('hex')}`;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PGOPTIONS = `-c search_path=${schema}`;
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.JWT_ISSUER = 'fitkitchen';
process.env.JWT_AUDIENCE = 'fitkitchen-api';
const root = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const pool = require('../../src/config/database');
const app = require('../../src/app');
const { validateUserPayload } = require('../../src/modules/user/user.validation');

test('Admin customer management against real HTTP, signed JWTs and PostgreSQL', async t => {
    let server;
    await root.query(`CREATE SCHEMA ${schema}`);
    t.after(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        await pool.end();
        await root.query(`DROP SCHEMA ${schema} CASCADE`);
        await root.end();
    });
    const sql = file => fs.readFile(path.join(__dirname, '../../db', file), 'utf8');
    const bootstrap = await sql('init/01_schema.sql');
    const migration = await sql('migrations/001_admin_customers.sql');
    const promotionsMigration = await sql('migrations/007_promotions.sql');
    // Reconstruct the pre-change schema to prove upgrades retain old accounts.
    await pool.query(bootstrap.replace("role VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('ADMIN', 'CUSTOMER')),\n    is_locked BOOLEAN NOT NULL DEFAULT FALSE,", "role VARCHAR(50) DEFAULT 'CUSTOMER',"));
    await pool.query(await sql('init/02_mockdata.sql'));
    await pool.query(promotionsMigration);
    assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'users' AND column_name = 'is_locked'", [schema])).rows[0].n, 0);
    const previous = (await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n;
    await t.test('existing-volume migration is repeatable and preserves records', async () => {
        await pool.query(migration);
        await pool.query(migration);
        assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n, previous);
        assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE is_locked IS NULL OR is_locked')).rows[0].n, 0);
    });
    await t.test('fresh schema and existing-volume migration stay compatible', async () => {
        const client = await root.connect();
        try {
            await client.query(`CREATE SCHEMA ${schema}_fresh`);
            await client.query(`SET search_path TO ${schema}_fresh`);
            await client.query(bootstrap);
            await client.query(await sql('init/02_mockdata.sql'));
            await client.query(await sql('init/03_admin_customers.sql'));
            await client.query(migration);
            await client.query(promotionsMigration);
            assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'admin_account_audit'", [`${schema}_fresh`])).rows[0].n, 8);
        } finally {
            await client.query('SET search_path TO public');
            await client.query(`DROP SCHEMA ${schema}_fresh CASCADE`);
            client.release();
        }
    });
    execFileSync(process.execPath, ['scripts/seed-admin-demo.js'], {
        cwd: path.join(__dirname, '../..'), env: { ...process.env, ADMIN_DEMO_PASSWORD: crypto.randomBytes(16).toString('hex') }
    });
    const accounts = (await pool.query("SELECT id, email, password_hash FROM users WHERE email LIKE '%@admin-demo.example.test'")).rows;
    const admin = accounts.find(user => user.email.startsWith('admin@'));
    const active = accounts.find(user => user.email.startsWith('active@'));
    const orders = accounts.find(user => user.email.startsWith('orders@'));
    assert.match(admin.password_hash, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
    const token = (id, overrides = {}, options = {}) => jwt.sign(overrides, process.env.JWT_SECRET, {
        subject: String(id), issuer: 'fitkitchen', audience: 'fitkitchen-api', expiresIn: '30m', ...options
    });
    const adminToken = token(admin.id);
    const customerToken = token(active.id, { role: 'ADMIN', is_locked: false });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(url, credential = adminToken, method = 'GET', body) {
        const response = await fetch(base + '/api' + url, { method, headers: {
            'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {})
        }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, body: response.status === 204 ? null : await response.json() };
    }
    const change = (id, body) => request(`/admin/customers/${id}/status`, adminToken, 'PATCH', body);
    await t.test('internal Admin account creation is not exposed', async () => {
        const response = await fetch(base + '/api/internal/admins', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'not-created@example.test', password: 'not-created', full_name: 'Not created' })
        });
        assert.equal(response.status, 404);
    });
    const auditCount = async id => (await pool.query('SELECT COUNT(*)::int AS n FROM admin_account_audit WHERE customer_id = $1', [id])).rows[0].n;

    await t.test('anonymous, forged, expired, wrong-audience and deleted-account tokens are denied', async () => {
        for (const credential of [null, 'invalid', adminToken.slice(0, -4) + 'xxxx', token(admin.id, {}, { expiresIn: -1 }), token(admin.id, {}, { audience: 'wrong' }), token('9223372036854775807')]) {
            assert.equal((await request('/admin/customers', credential)).status, 401);
        }
        assert.equal((await request('/admin/customers', customerToken)).status, 403);
        assert.equal((await request('/admin/customers', adminToken)).status, 200);
        assert.equal((await request('/session', customerToken)).body.data.role, 'CUSTOMER');
    });
    await t.test('legacy user/address/meal routes enforce ownership and roles without closing public menu reads', async () => {
        assert.equal((await request('/users', null)).status, 401);
        assert.equal((await request('/users', customerToken)).status, 403);
        for (const suffix of ['', '/addresses', '/addresses/1']) {
            for (const method of suffix === '/addresses/1' ? ['PATCH', 'DELETE'] : suffix ? ['GET', 'POST'] : ['GET', 'PATCH', 'DELETE']) {
                assert.equal((await request(`/users/${orders.id}${suffix}`, customerToken, method, method === 'POST' || method === 'PATCH' ? {} : undefined)).status, 403);
            }
        }
        assert.equal((await request(`/users/${active.id}`, customerToken)).status, 200);
        assert.equal((await request(`/users/${active.id}/addresses`, customerToken)).status, 200);
        assert.equal((await request('/meals', null)).status, 200);
        for (const [url, method] of [['/meals', 'POST'], ['/meals/1', 'PATCH'], ['/meals/1', 'DELETE']]) {
            assert.equal((await request(url, customerToken, method, {})).status, 403);
            assert.equal((await request(url, null, method, {})).status, 401);
        }
    });
    await t.test('registration and profile updates cannot assign ADMIN or unlock accounts', async () => {
        assert.ok(validateUserPayload({ email: 'new@example.test', full_name: 'New', password: 'testing123', role: 'ADMIN' }).errors.length);
        assert.equal((await request('/users', null, 'POST', { email: 'new@example.test', full_name: 'New', password: 'testing123', role: 'ADMIN' })).status, 400);
        for (const body of [{ role: 'ADMIN' }, { is_locked: false }]) assert.equal((await request(`/users/${active.id}`, customerToken, 'PATCH', body)).status, 400);
        assert.equal((await request('/users', null, 'POST', { email: 'new@example.test', full_name: 'New', password: 'testing123' })).body.data.role, 'CUSTOMER');
    });
    await t.test('directory searches name, email and phone; filters and paginates; never exposes hashes', async () => {
        const all = await request('/admin/customers');
        assert.ok(all.body.data.every(user => user.role === 'CUSTOMER' && !('password_hash' in user)));
        for (const term of ['Demo customer with orders', orders.email, '0900000003']) {
            const found = await request(`/admin/customers?search=${encodeURIComponent(term)}`);
            assert.deepEqual(found.body.data.map(user => user.id), [orders.id]);
        }
        assert.equal((await request('/admin/customers?search=%27%20OR%201%3D1--')).body.pagination.total, 0);
        assert.equal((await request('/admin/customers?search=%25')).body.pagination.total, 0);
        assert.equal((await request('/admin/customers?page_size=1')).body.data.length, 1);
        assert.equal((await request('/admin/customers?page=999')).body.data.length, 0);
        for (const query of ['page=0', 'status=unknown', 'page_size=101']) assert.equal((await request(`/admin/customers?${query}`)).status, 400);
        assert.equal((await request('/admin/customers/9223372036854775807')).status, 404);
        assert.equal((await request(`/admin/customers/${admin.id}`)).status, 404);
        assert.equal((await request('/admin/customers/nope')).status, 400);
    });
    await t.test('profile, addresses, orders and current plans belong to the chosen customer', async () => {
        const profile = await request(`/admin/customers/${orders.id}`);
        assert.equal(profile.body.data.addresses.length, 1);
        assert.equal(profile.body.data.unfinished_order_count, 1);
        assert.equal((await request(`/admin/customers/${active.id}`)).body.data.addresses.length, 0);
        assert.equal((await request(`/admin/customers/${active.id}/orders`)).body.data.length, 0);
        assert.equal((await request(`/admin/customers/${orders.id}/orders`)).body.pagination.total, 2);
        const plan = (await request(`/admin/customers/${orders.id}/subscriptions`)).body.data[0];
        assert.equal(plan.status, 'ACTIVE');
        await pool.query(`INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, status, payment_method, total_amount)
            SELECT user_id, plan_id, CURRENT_DATE - 40, CURRENT_DATE - 10, 'ACTIVE', 'COD', 0 FROM user_subscriptions WHERE id = $1`, [plan.id]);
        assert.equal((await request(`/admin/customers/${orders.id}/subscriptions`)).body.pagination.total, 1);
        assert.equal((await request(`/admin/customers/${active.id}/subscriptions`)).body.data.length, 0);
    });
    await t.test('calendar dates are ISO date-only strings, independent of server timezone', async () => {
        const result = await request(`/admin/customers/${orders.id}/orders`);
        for (const order of result.body.data) {
            const expected = (await pool.query("SELECT to_char(delivery_date, 'YYYY-MM-DD') AS value FROM customer_orders WHERE id = $1", [order.id])).rows[0].value;
            assert.equal(order.delivery_date, expected);
        }
        const plans = await request(`/admin/customers/${orders.id}/subscriptions`);
        for (const plan of plans.body.data) {
            const expected = (await pool.query("SELECT to_char(start_date, 'YYYY-MM-DD') AS start, to_char(end_date, 'YYYY-MM-DD') AS end FROM user_subscriptions WHERE id = $1", [plan.id])).rows[0];
            assert.equal(plan.start_date, expected.start);
            assert.equal(plan.end_date, expected.end);
        }
    });
    await t.test('invalid requests, customer attempts and Admin targets cannot change status or write audit', async () => {
        for (const body of [{}, { is_locked: true, reason: ' ' }, { is_locked: 'true', reason: 'x' }, { is_locked: true, reason: 'x', confirm_unfinished_orders: 'yes' }]) {
            assert.equal((await change(active.id, body)).status, 400);
        }
        assert.equal((await request(`/admin/customers/${active.id}/status`, customerToken, 'PATCH', { is_locked: true, reason: 'x' })).status, 403);
        assert.equal((await change(admin.id, { is_locked: true, reason: 'x' })).status, 404);
        assert.equal(await auditCount(active.id), 0);
    });
    await t.test('unfinished orders require confirmation, confirmed lock is atomic and old token is rejected immediately', async () => {
        const warned = await change(orders.id, { is_locked: true, reason: 'Support review' });
        assert.equal(warned.status, 409);
        assert.equal(warned.body.code, 'UNFINISHED_ORDERS');
        assert.equal(warned.body.unfinished_order_count, 1);
        assert.equal(await auditCount(orders.id), 0);
        const oldToken = token(orders.id);
        assert.equal((await request('/session', oldToken)).status, 200);
        const locked = await change(orders.id, { is_locked: true, reason: '  Support review  ', confirm_unfinished_orders: true });
        assert.equal(locked.status, 200);
        assert.equal(locked.body.data.is_locked, true);
        assert.equal((await request('/session', oldToken)).body.code, 'ACCOUNT_LOCKED');
        assert.equal((await request(`/users/${orders.id}`, oldToken)).body.code, 'ACCOUNT_LOCKED');
        assert.equal((await request('/admin/customers?status=locked')).body.data.some(user => user.id === orders.id), true);
        const audit = (await pool.query('SELECT * FROM admin_account_audit WHERE customer_id = $1', [orders.id])).rows[0];
        assert.equal(audit.admin_id, admin.id);
        assert.equal(audit.customer_id, orders.id);
        assert.equal(audit.action, 'LOCK');
        assert.equal(audit.reason, 'Support review');
        assert.equal(audit.was_locked, false);
        assert.equal(audit.is_locked, true);
        assert.ok(audit.created_at instanceof Date);
        assert.equal((await change(orders.id, { is_locked: true, reason: 'retry' })).body.changed, false);
        assert.equal(await auditCount(orders.id), 1);
        assert.equal((await change(orders.id, { is_locked: false, reason: 'Resolved' })).body.changed, true);
        assert.equal((await request('/session', oldToken)).status, 200);
        assert.equal((await change(orders.id, { is_locked: false, reason: 'retry' })).body.changed, false);
        assert.equal(await auditCount(orders.id), 2);
    });
    await t.test('backend rechecks orders after a preview and again on confirmed request', async () => {
        assert.equal((await request(`/admin/customers/${active.id}`)).body.data.unfinished_order_count, 0);
        await pool.query(`INSERT INTO customer_orders (user_id, total_amount, status, payment_method, delivery_date)
            VALUES ($1, 1, 'PENDING', 'COD', CURRENT_DATE)`, [active.id]);
        assert.equal((await change(active.id, { is_locked: true, reason: 'Review' })).status, 409);
        await pool.query(`INSERT INTO customer_orders (user_id, total_amount, status, payment_method, delivery_date)
            VALUES ($1, 1, 'DELIVERING', 'COD', CURRENT_DATE)`, [active.id]);
        assert.equal((await change(active.id, { is_locked: true, reason: 'Review' })).body.unfinished_order_count, 2);
        assert.equal((await change(active.id, { is_locked: true, reason: 'Confirmed', confirm_unfinished_orders: true })).status, 200);
        await change(active.id, { is_locked: false, reason: 'Resolved' });
        await pool.query('DELETE FROM customer_orders WHERE user_id = $1', [active.id]);
    });
    await t.test('audit insert failure rolls back the status update in PostgreSQL', async () => {
        const before = await auditCount(active.id);
        await pool.query(`CREATE FUNCTION reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.reason = 'FAIL_AUDIT' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER reject_test_audit BEFORE INSERT ON admin_account_audit FOR EACH ROW EXECUTE FUNCTION reject_test_audit()`);
        try {
            assert.equal((await change(active.id, { is_locked: true, reason: 'FAIL_AUDIT' })).status, 500);
            assert.equal((await pool.query('SELECT is_locked FROM users WHERE id = $1', [active.id])).rows[0].is_locked, false);
            assert.equal(await auditCount(active.id), before);
        } finally { await pool.query('DROP TRIGGER reject_test_audit ON admin_account_audit; DROP FUNCTION reject_test_audit()'); }
    });
    await t.test('user update failure cannot create an audit row', async () => {
        const before = await auditCount(active.id);
        await pool.query(`CREATE FUNCTION reject_test_update() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.is_locked <> OLD.is_locked THEN RAISE EXCEPTION 'injected update failure'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER reject_test_update BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_test_update()`);
        try {
            assert.equal((await change(active.id, { is_locked: true, reason: 'Review' })).status, 500);
            assert.equal(await auditCount(active.id), before);
            assert.equal((await pool.query('SELECT is_locked FROM users WHERE id = $1', [active.id])).rows[0].is_locked, false);
        } finally { await pool.query('DROP TRIGGER reject_test_update ON users; DROP FUNCTION reject_test_update()'); }
    });
    await t.test('concurrent duplicate locks create exactly one transition and audit row', async () => {
        const before = await auditCount(active.id);
        const results = await Promise.all([change(active.id, { is_locked: true, reason: 'Concurrent' }), change(active.id, { is_locked: true, reason: 'Concurrent' })]);
        assert.ok(results.every(result => result.status === 200));
        assert.equal(results.filter(result => result.body.changed).length, 1);
        assert.equal(await auditCount(active.id), before + 1);
        await change(active.id, { is_locked: false, reason: 'Resolved' });
    });
    await t.test('audit retention prevents deleting either the customer or the acting Admin', async () => {
        const before = await auditCount(active.id);
        assert.equal((await request(`/users/${active.id}`, adminToken, 'DELETE')).status, 409);
        assert.equal((await request(`/users/${admin.id}`, adminToken, 'DELETE')).status, 409);
        assert.equal(await auditCount(active.id), before);
        assert.equal((await request('/session', adminToken)).status, 200);
    });
    await t.test('Admin orders are searchable and paginated, with stored items and conflict-safe fulfillment updates', async () => {
        assert.equal((await request('/session')).body.data.role, 'ADMIN');
        assert.equal((await request('/orders')).status, 403);
        const seeded = await request('/admin/orders?search=%231');
        assert.equal(seeded.status, 200);
        assert.equal(seeded.body.data[0].id, '1');
        const details = await request('/admin/orders/1');
        assert.equal(details.body.data.items[0].unit_price, '65000.00');
        assert.equal(typeof details.body.data.items[0].options.extra_meat, 'string');
        assert.equal((await request('/admin/orders?page_size=1&page=2')).body.data.length, 1);
        assert.equal((await request('/admin/orders?search=%25')).body.pagination.total, 0);
        assert.equal((await request('/admin/orders/0')).status, 400);
        assert.equal((await request('/admin/orders/9223372036854775807')).status, 404);
        assert.equal((await request('/admin/orders/1', customerToken)).status, 403);
        assert.equal((await request('/admin/orders', null)).status, 401);

        const { rows: [order] } = await pool.query(`INSERT INTO customer_orders
            (user_id, total_amount, status, payment_method, delivery_date)
            VALUES ($1, 100, 'PENDING', 'COD', CURRENT_DATE) RETURNING id`, [active.id]);
        const update = (expected_status, status, credential = adminToken) =>
            request(`/admin/orders/${order.id}/status`, credential, 'PATCH', { expected_status, status });
        assert.equal((await update('PENDING', 'PREPARING', customerToken)).status, 403);
        assert.equal((await update('PENDING', 'COMPLETED')).status, 400);
        assert.equal((await update('PENDING', 'PREPARING')).body.data.status, 'PREPARING');
        assert.equal((await update('PENDING', 'PREPARING')).status, 200);
        assert.equal((await update('PENDING', 'CANCELLED')).status, 409);
        assert.equal((await request(`/admin/orders/${order.id}`)).body.data.status, 'PREPARING');
        assert.equal((await update('PREPARING', 'DELIVERING')).body.data.status, 'DELIVERING');
        const completed = await update('DELIVERING', 'COMPLETED');
        assert.equal(completed.status, 200);
        assert.equal(completed.body.data.status, 'COMPLETED');
        assert.equal(completed.body.data.payment_status, 'PAID');
        assert.equal((await request(`/admin/orders/${order.id}`)).body.data.payment_status, 'PAID');
    });
    await t.test('Admin overview counts paid orders in the kitchen calendar and excludes cancelled orders', async () => {
        const url = '/admin/overview?range=last_week';
        assert.equal((await request(url, customerToken)).status, 403);
        assert.equal((await request('/admin/overview?range=last_year')).status, 400);
        const baseline = await request(url);
        assert.equal(baseline.status, 200);
        const before = baseline.body.data;
        assert.equal(before.revenue_series.length, 7);
        const { rows: [order] } = await pool.query(`INSERT INTO customer_orders
            (total_amount, status, payment_method, payment_status, delivery_date, created_at)
            VALUES (111, 'COMPLETED', 'COD', 'PAID', $1::date,
                ($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone')),
                (999, 'CANCELLED', 'COD', 'PAID', $1::date,
                ($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
            RETURNING id`, [before.revenue_series[0].date]);
        const after = (await request(url)).body.data;
        assert.equal(Number(after.period_revenue), Number(before.period_revenue) + 111);
        assert.equal(Number(after.revenue_series[0].revenue), Number(before.revenue_series[0].revenue) + 111);
        assert.equal(after.daily_revenue, before.daily_revenue);
        assert.equal(typeof order.id, 'string');
        assert.ok(after.recent_orders.every(({ id, total_amount }) => typeof id === 'string' && typeof total_amount === 'string'));
    });
    await t.test('overview supports monthly grouping, custom ranges and top N meals with revenue', async () => {
        const { rows: meals } = await pool.query('SELECT id, name FROM meals ORDER BY id LIMIT 2');
        const { rows: [order] } = await pool.query(`INSERT INTO customer_orders
            (total_amount, status, payment_method, payment_status, delivery_date, created_at)
            VALUES (350000, 'COMPLETED', 'COD', 'PAID', '2026-01-15',
                ('2026-01-15 12:00:00'::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
            RETURNING id`);
        await pool.query(`INSERT INTO order_items
            (order_id, meal_id, quantity, unit_price, calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot)
            VALUES ($1, $2, 3, 70000, 500, 40, 50, 10),
                   ($1, $3, 2, 70000, 450, 35, 45, 12)`, [order.id, meals[0].id, meals[1].id]);
        const res = await request('/admin/overview?start_date=2026-01-01&end_date=2026-02-28&group_by=month&top_limit=2');
        assert.equal(res.status, 200);
        assert.equal(res.body.data.group_by, 'month');
        assert.equal(res.body.data.revenue_series.length, 2);
        assert.equal(res.body.data.revenue_series[0].label, '2026-01');
        assert.equal(Number(res.body.data.revenue_series[0].revenue), 350000);
        assert.equal(res.body.data.top_meals.length, 2);
        assert.equal(res.body.data.top_meals[0].quantity, 3);
        assert.equal(res.body.data.top_meals[0].revenue, '210000.00');

        // Unpaid orders must not inflate the ranking, which is based on paid revenue.
        const { rows: [unpaid] } = await pool.query(`INSERT INTO customer_orders
            (total_amount, status, payment_method, payment_status, delivery_date, created_at)
            VALUES (700000, 'PENDING', 'COD', 'PENDING', '2026-01-16',
                ('2026-01-16 12:00:00'::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
            RETURNING id`);
        await pool.query(`INSERT INTO order_items
            (order_id, meal_id, quantity, unit_price, calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot)
            VALUES ($1, $2, 10, 70000, 450, 35, 45, 12)`, [unpaid.id, meals[1].id]);
        const again = await request('/admin/overview?start_date=2026-01-01&end_date=2026-02-28&group_by=month&top_limit=2');
        assert.equal(again.body.data.top_meals[0].quantity, 3);
        assert.equal(again.body.data.top_meals[1].quantity, 2);
    });
    await t.test('monthly overview reports full daily series and paid customer renewals within seven days', async () => {
        const before = (await request('/admin/overview?range=last_month')).body.data;
        const monthDays = (await pool.query(
            `SELECT (date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)::date
                     - (date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
                        - INTERVAL '1 month')::date)::int AS days`
        )).rows[0].days;
        assert.equal(before.revenue_series.length, monthDays);

        const { rows: [plan] } = await pool.query('SELECT id FROM subscription_plans ORDER BY id LIMIT 1');
        const { rows: customers } = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, role)
             VALUES ($1, 'unused', 'Renewed fixture', 'CUSTOMER'),
                    ($2, 'unused', 'Not renewed fixture', 'CUSTOMER')
             RETURNING id, full_name`,
            [`renewed-${schema}@example.test`, `not-renewed-${schema}@example.test`]
        );
        const renewedCustomer = customers.find(customer => customer.full_name === 'Renewed fixture');
        const notRenewedCustomer = customers.find(customer => customer.full_name === 'Not renewed fixture');
        await pool.query(
            `WITH calendar AS (
                SELECT (date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
                        - INTERVAL '1 month' + INTERVAL '14 days')::date AS end_date
             )
             INSERT INTO user_subscriptions
                (user_id, plan_id, start_date, end_date, status, payment_method, payment_status, total_amount)
             SELECT customer.id, $3, calendar.end_date - 7, calendar.end_date, 'ACTIVE', 'COD', 'PAID', 1000
             FROM calendar CROSS JOIN (VALUES ($1::bigint), ($2::bigint)) AS customer(id)`,
            [renewedCustomer.id, notRenewedCustomer.id, plan.id]
        );
        await pool.query(
            `WITH calendar AS (
                SELECT (date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
                        - INTERVAL '1 month' + INTERVAL '14 days')::date AS end_date
             )
             INSERT INTO user_subscriptions
                (user_id, plan_id, start_date, end_date, status, payment_method, payment_status, total_amount)
             SELECT $1, $2, calendar.end_date + 2, calendar.end_date + 20,
                    'ACTIVE', 'COD', 'PAID', 1000
             FROM calendar`,
            [renewedCustomer.id, plan.id]
        );

        const after = (await request('/admin/overview?range=last_month')).body.data;
        assert.equal(after.renewal_eligible_customers, before.renewal_eligible_customers + 2);
        assert.equal(after.renewed_customers, before.renewed_customers + 1);
        assert.equal(
            after.renewal_rate,
            (Math.round((after.renewed_customers / after.renewal_eligible_customers) * 1000) / 10).toFixed(1)
        );
        assert.equal((await request('/admin/overview?range=this_month')).status, 200);
    });
});

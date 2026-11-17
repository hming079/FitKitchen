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
    // Reconstruct the pre-change schema to prove upgrades retain old accounts.
    await pool.query(bootstrap.replace("role VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('ADMIN', 'CUSTOMER')),\n    is_locked BOOLEAN NOT NULL DEFAULT FALSE,", "role VARCHAR(50) DEFAULT 'CUSTOMER',"));
    await pool.query(await sql('init/02_mockdata.sql'));
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
    await t.test('internal provisioning creates real Admin accounts without JWT, but requires its own local access key', async () => {
        const key = crypto.randomBytes(48).toString('hex');
        const password = crypto.randomBytes(16).toString('hex');
        const payload = { email: 'admin1@fitkitchen.example.test', full_name: 'Internal administrator', password };
        async function provision(body = payload, suppliedKey = key) {
            const response = await fetch(base + '/api/internal/admins', { method: 'POST', headers: {
                'Content-Type': 'application/json', ...(suppliedKey ? { 'X-Admin-Provisioning-Key': suppliedKey } : {})
            }, body: JSON.stringify(body) });
            return { status: response.status, body: await response.json() };
        }
        try {
            process.env.INTERNAL_ADMIN_PROVISIONING_ENABLED = 'false';
            process.env.ADMIN_PROVISIONING_KEY = key;
            assert.equal((await provision()).status, 404);
            process.env.INTERNAL_ADMIN_PROVISIONING_ENABLED = 'true';
            for (const suppliedKey of ['', 'wrong-key']) assert.equal((await provision(payload, suppliedKey)).status, 403);
            assert.equal((await provision({ ...payload, role: 'ADMIN' })).status, 400);
            assert.equal((await provision({ ...payload, password: 'short' })).status, 400);
            const created = await provision();
            assert.equal(created.status, 201);
            assert.equal(created.body.data.role, 'ADMIN');
            assert.equal(created.body.data.is_locked, false);
            assert.equal('password_hash' in created.body.data, false);
            const saved = (await pool.query('SELECT password_hash FROM users WHERE id = $1', [created.body.data.id])).rows[0];
            const [, salt, encoded] = saved.password_hash.split(':');
            const derived = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key)));
            assert.equal(derived.toString('hex'), encoded);
            assert.equal((await request('/admin/customers', token(created.body.data.id))).status, 200);
            const issued = execFileSync(process.execPath, ['scripts/demo-token.js', payload.email], { cwd: path.join(__dirname, '../..'), env: process.env, encoding: 'utf8' }).trim();
            assert.equal(jwt.verify(issued, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'fitkitchen', audience: 'fitkitchen-api' }).sub, created.body.data.id);
            assert.equal((await request('/admin/customers', issued)).status, 200);
            assert.equal((await provision()).status, 409);
            assert.equal((await provision({ ...payload, email: active.email })).status, 409);
            assert.equal((await pool.query('SELECT role FROM users WHERE id=$1', [active.id])).rows[0].role, 'CUSTOMER');
            assert.equal((await provision({ ...payload, email: 'second-admin@example.test' })).status, 201);
            const previous = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            try { assert.equal((await provision()).status, 404); }
            finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
        } finally {
            delete process.env.INTERNAL_ADMIN_PROVISIONING_ENABLED;
            delete process.env.ADMIN_PROVISIONING_KEY;
        }
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
});

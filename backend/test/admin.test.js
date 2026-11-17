const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateStatus, parseListQuery } = require('../src/modules/admin/customer.validation');
const { requireRole, requireSelf } = require('../src/middleware/auth');
const { internalAccess } = require('../src/modules/admin/provisioning');

function response() {
    return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
}

test('status requires a boolean, a trimmed reason and an explicit boolean confirmation', () => {
    assert.throws(() => validateStatus({ is_locked: 'true', reason: 'x' }), /boolean/);
    assert.throws(() => validateStatus({ is_locked: true, reason: '   ' }), /reason/);
    assert.throws(() => validateStatus({ is_locked: true, reason: 'x', confirm_unfinished_orders: 'true' }), /boolean/);
    assert.throws(() => validateStatus({ is_locked: true, reason: 'x'.repeat(1001) }), /reason/);
    assert.deepEqual(validateStatus({ is_locked: false, reason: ' reviewed ' }), {
        is_locked: false, reason: 'reviewed', confirm_unfinished_orders: false
    });
});

test('list query is bounded and rejects invalid filters and pagination', () => {
    assert.deepEqual(parseListQuery({}), { search: '', status: 'all', page: 1, page_size: 20 });
    for (const query of [{ page: '0' }, { page: '1.2' }, { page_size: '101' }, { status: 'other' }, { search: ['x'] }]) {
        assert.throws(() => parseListQuery(query));
    }
});

test('role guard fails closed and ownership never trusts the requested user ID', () => {
    for (const user of [undefined, { id: '1', role: 'CUSTOMER' }]) {
        const res = response();
        requireRole('ADMIN')({ user }, res, () => assert.fail('must deny'));
        assert.equal(res.statusCode, user ? 403 : 401);
    }
    let allowed = false;
    requireRole('ADMIN')({ user: { id: '1', role: 'ADMIN' } }, response(), () => { allowed = true; });
    assert.equal(allowed, true);
    const res = response();
    requireSelf('userId')({ user: { id: '1', role: 'CUSTOMER' }, params: { userId: '2' } }, res, () => assert.fail('must deny'));
    assert.equal(res.statusCode, 403);
});

test('internal provisioning does not trust forwarded loopback addresses or JWT credentials', () => {
    const previousEnabled = process.env.INTERNAL_ADMIN_PROVISIONING_ENABLED;
    const previousKey = process.env.ADMIN_PROVISIONING_KEY;
    process.env.INTERNAL_ADMIN_PROVISIONING_ENABLED = 'true';
    process.env.ADMIN_PROVISIONING_KEY = 'x'.repeat(48);
    try {
        const res = response();
        internalAccess({ socket: { remoteAddress: '203.0.113.5' }, get: header => header === 'X-Admin-Provisioning-Key' ? 'x'.repeat(48) : '127.0.0.1' }, res, () => assert.fail('remote peer must be denied'));
        assert.equal(res.statusCode, 403);
        const missing = response();
        internalAccess({ socket: { remoteAddress: '127.0.0.1' }, get: () => undefined }, missing, () => assert.fail('key required'));
        assert.equal(missing.statusCode, 403);
    } finally {
        if (previousEnabled === undefined) delete process.env.INTERNAL_ADMIN_PROVISIONING_ENABLED; else process.env.INTERNAL_ADMIN_PROVISIONING_ENABLED = previousEnabled;
        if (previousKey === undefined) delete process.env.ADMIN_PROVISIONING_KEY; else process.env.ADMIN_PROVISIONING_KEY = previousKey;
    }
});

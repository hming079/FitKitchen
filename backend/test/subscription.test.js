const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    validateCheckout,
    validatePlan,
    parseAdminListQuery,
    validateSubscriptionUpdate,
    calendarDate
} = require('../src/modules/subscription/subscription.validation');

test('checkout accepts only known fields, real calendar dates and supported payment methods', () => {
    assert.deepEqual(validateCheckout({ plan_id: '1', address_id: 2, start_date: '2026-11-23' }), {
        plan_id: '1', address_id: '2', start_date: '2026-11-23', payment_method: 'COD'
    });
    for (const body of [
        null,
        [],
        { plan_id: '1', address_id: '2' },
        { plan_id: '0', address_id: '2', start_date: '2026-11-23' },
        { plan_id: '1', address_id: '9223372036854775808', start_date: '2026-11-23' },
        { plan_id: '1', address_id: '2', start_date: '2026-02-30' },
        { plan_id: '1', address_id: '2', start_date: '23/11/2026' },
        { plan_id: '1', address_id: '2', start_date: '2026-11-23', payment_method: 'ONLINE' },
        // The server computes end dates and prices; clients cannot supply them.
        { plan_id: '1', address_id: '2', start_date: '2026-11-23', end_date: '2026-11-29' },
        { plan_id: '1', address_id: '2', start_date: '2026-11-23', total_amount: 1 }
    ]) {
        assert.throws(() => validateCheckout(body), error => error.status === 400);
    }
});

test('calendar dates reject impossible days, including leap-year edge cases', () => {
    assert.equal(calendarDate('2028-02-29', 'start_date'), '2028-02-29');
    assert.throws(() => calendarDate('2026-02-29', 'start_date'));
    assert.throws(() => calendarDate('2026-13-01', 'start_date'));
});

test('plan payload requires core fields, bounds numbers and normalizes gifts', () => {
    assert.deepEqual(validatePlan({
        name: '  Eat Clean 7 days ', duration_days: 7, meals_per_day: 2, price: 850000,
        gifts: [{ gift_name: ' Protein bar ', quantity: 2, product_id: '3' }]
    }), {
        name: 'Eat Clean 7 days', duration_days: 7, meals_per_day: 2, price: 850000, is_active: true,
        gifts: [{ gift_name: 'Protein bar', quantity: 2, product_id: '3', description: null }]
    });
    const valid = { name: 'Plan', duration_days: 30, meals_per_day: 2, price: 1 };
    for (const body of [
        { ...valid, name: '   ' },
        { ...valid, duration_days: 0 },
        { ...valid, duration_days: 7.5 },
        { ...valid, meals_per_day: 7 },
        { ...valid, price: -1 },
        { ...valid, price: 1.234 },
        { ...valid, price: '850000' },
        { ...valid, gifts: [{ quantity: 1 }] },
        { ...valid, gifts: [{ gift_name: 'x', quantity: 0 }] },
        { ...valid, gifts: Array.from({ length: 11 }, () => ({ gift_name: 'x' })) },
        { ...valid, unknown: true },
        { name: 'Missing numbers' }
    ]) {
        assert.throws(() => validatePlan(body), error => error.status === 400);
    }
});

test('partial plan updates keep only provided fields and reject empty bodies', () => {
    assert.deepEqual(validatePlan({ is_active: false }, { partial: true }), { is_active: false });
    assert.deepEqual(validatePlan({ gifts: [] }, { partial: true }), { gifts: [] });
    assert.throws(() => validatePlan({}, { partial: true }), /At least one/);
});

test('admin list query is bounded and only accepts known views', () => {
    assert.deepEqual(parseAdminListQuery({}), { search: '', view: 'all', plan_id: null, page: 1, page_size: 20 });
    assert.equal(parseAdminListQuery({ plan_id: 'all' }).plan_id, null);
    for (const query of [{ view: 'expired' }, { page: '0' }, { page_size: '101' }, { plan_id: 'x' }, { search: ['x'] }]) {
        assert.throws(() => parseAdminListQuery(query));
    }
});

test('admin subscription updates allow only confirmation, cancellation and recording payment', () => {
    assert.deepEqual(validateSubscriptionUpdate({ status: 'ACTIVE' }), { status: 'ACTIVE', payment_status: null });
    assert.deepEqual(validateSubscriptionUpdate({ payment_status: 'PAID' }), { status: null, payment_status: 'PAID' });
    for (const body of [{}, { status: 'PENDING' }, { payment_status: 'REFUNDED' }, { status: 'ACTIVE', note: 'x' }]) {
        assert.throws(() => validateSubscriptionUpdate(body), error => error.status === 400);
    }
});

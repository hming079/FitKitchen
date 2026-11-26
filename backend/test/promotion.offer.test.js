const { test } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/modules/promotion/promotion.service');

// Minimal stand-in for a pg client: first query returns the promotion, then the date, then usage.
function fakeDb(promotion, { total = 0, customer = 0, today = '2026-06-15' } = {}) {
    const rows = [[promotion], [{ today }], [{ total, customer }]];
    return { query: async () => ({ rows: rows.shift() ?? [] }) };
}

const base = {
    id: 1, code: 'TEST', description: null, discount_type: 'PERCENTAGE', discount_value: '10.00',
    min_order_amount: '0.00', max_discount_amount: null, start_date: null, end_date: null,
    usage_limit: null, per_user_limit: null, is_active: true
};

test('percentage discount is exact in cents and floors fractional cents', async () => {
    const offer = await service.calculateOffer(fakeDb(base), '7', 'test', 12345);
    assert.equal(offer.discount_amount, '12.34');
    assert.equal(offer.total_amount, '111.11');
    const fractional = await service.calculateOffer(fakeDb({ ...base, discount_value: '12.50' }), '7', 'test', 30000);
    assert.equal(fractional.discount_amount, '37.50');
});

test('percentage cap, fixed discount and subtotal ceiling', async () => {
    const capped = await service.calculateOffer(
        fakeDb({ ...base, max_discount_amount: '50000.00' }), '7', 'test', 1000000 * 100);
    assert.equal(capped.discount_amount, '50000.00');
    const fixed = await service.calculateOffer(
        fakeDb({ ...base, discount_type: 'FIXED', discount_value: '50000.00' }), '7', 'test', 30000 * 100);
    assert.equal(fixed.discount_amount, '30000.00');
    assert.equal(fixed.total_amount, '0.00');
});

test('promotion is refused when inactive, outside its dates, below minimum or exhausted', async () => {
    const reject = (promotion, usage, subtotal = 100000 * 100) =>
        assert.rejects(service.calculateOffer(fakeDb(promotion, usage), '7', 'test', subtotal), { status: 400 });
    await reject({ ...base, is_active: false });
    await reject({ ...base, start_date: '2026-07-01' });
    await reject({ ...base, end_date: '2026-06-01' });
    await reject({ ...base, min_order_amount: '200000.00' });
    await reject({ ...base, usage_limit: 5 }, { total: 5 });
    await reject({ ...base, per_user_limit: 1 }, { customer: 1 });
    await assert.rejects(
        service.calculateOffer({ query: async () => ({ rows: [] }) }, '7', 'test', 100),
        { code: 'PROMOTION_UNAVAILABLE' });
});

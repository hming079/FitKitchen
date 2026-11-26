const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validatePromotion, validateCodeBody } = require("../src/modules/promotion/promotion.validation");
const { validateCheckout } = require("../src/modules/order/order.validation");

const promotion = {
  code: " welcome-15 ",
  discount_type: "PERCENTAGE",
  discount_value: 15,
};

test("promotion input normalizes codes and supplies safe defaults", () => {
  assert.deepEqual(validatePromotion(promotion), {
    code: "WELCOME-15",
    description: null,
    discount_type: "PERCENTAGE",
    discount_value: 15,
    min_order_amount: 0,
    max_discount_amount: null,
    start_date: null,
    end_date: null,
    usage_limit: null,
    per_user_limit: null,
    is_active: true,
  });
  assert.deepEqual(validateCodeBody({ code: " save10 " }), { code: "SAVE10" });
});

test("promotion validation rejects invalid percentages, limits, dates, and unknown fields", () => {
  for (const input of [
    { ...promotion, discount_value: 101 },
    { ...promotion, max_discount_amount: 0 },
    { ...promotion, start_date: "2026-02-31" },
    { ...promotion, start_date: "2026-12-02", end_date: "2026-12-01" },
    { ...promotion, usage_limit: 0 },
    { ...promotion, unexpected: true },
    { ...promotion, code: "not a code" },
    { code: "FIXED", discount_type: "FIXED", discount_value: 10, max_discount_amount: 5 },
  ]) {
    assert.throws(() => validatePromotion(input));
  }
});

test("promotion updates validate fields and require at least one supported change", () => {
  assert.deepEqual(validatePromotion({ is_active: false }, { partial: true }), { is_active: false });
  assert.throws(() => validatePromotion({}, { partial: true }), /at least one field/);
  assert.throws(() => validatePromotion({ active: false }, { partial: true }), /unsupported fields/);
});

test("checkout normalizes an optional promotion code without changing COD defaults", () => {
  const today = new Date().toISOString().slice(0, 10);
  const valid = validateCheckout({
    address_id: "1",
    delivery_date: today,
    payment_method: "COD",
    promotion_code: " save10 ",
  });
  assert.equal(valid.promotion_code, "SAVE10");
  assert.throws(() => validateCheckout({
    address_id: "1",
    delivery_date: today,
    payment_method: "COD",
    promotion_code: "x".repeat(51),
  }));
});

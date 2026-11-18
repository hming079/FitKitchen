const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateCategoryPayload } = require("../src/modules/category/category.validation");
const { validateProductListQuery, validateProductPayload, validateStockAdjustment } = require("../src/modules/product/product.validation");
const { validateMealListQuery, validateMealPayload } = require("../src/modules/meal/meal.validation");
const { validateOptionPayload } = require("../src/modules/meal/option.validation");

test("category requires a trimmed, bounded name and allows clearing the description", () => {
    for (const body of [undefined, [], {}, { name: "   " }, { name: "x".repeat(101) }, { name: "x\0" }, { name: "x", description: 3 }]) {
        assert.ok(validateCategoryPayload(body).errors.length);
    }
    assert.deepEqual(validateCategoryPayload({ name: "  Bento  ", description: null, id: 5 }), {
        data: { name: "Bento", description: null }, errors: []
    });
    assert.deepEqual(validateCategoryPayload({ description: null }, { partial: true }).data, { description: null });
    assert.ok(validateCategoryPayload({ id: 5 }, { partial: true }).errors.length);
});

test("product validates creation and partial updates against database bounds", () => {
    for (const body of [{}, { price: 0 }, { name: "Tea" }]) {
        assert.ok(validateProductPayload(body).errors.length);
    }
    for (const patch of [
        {}, { name: "x".repeat(201) }, { category: "x".repeat(101) }, { unit: "x".repeat(51) },
        { price: -1 }, { price: null }, { price: 1e10 }, { price: "0" },
        { stock_quantity: 1.5 }, { stock_quantity: 2147483648 }, { is_available: "false" },
        { image_url: false }
    ]) {
        assert.ok(validateProductPayload(patch, { partial: true }).errors.length);
    }
    const fields = { name: "Tea", price: 0, stock_quantity: 0, is_available: false, unit: null };
    assert.deepEqual(validateProductPayload({ ...fields, name: " Tea " }), { data: fields, errors: [] });
    assert.deepEqual(validateProductPayload({ category: null }, { partial: true }).data, { category: null });
});

test("product stock adjustment requires a nonzero integer within its bounds", () => {
    for (const adjustment of [null, 0, 1.25, true, "3", -1000001, 1000001]) {
        assert.ok(validateStockAdjustment({ adjustment }).errors.length);
    }
    for (const adjustment of [-1000000, 1, 1000000]) {
        assert.deepEqual(validateStockAdjustment({ adjustment }), { data: adjustment, errors: [] });
    }
});

test("customization validates field limits and preserves negative amounts and false", () => {
    for (const body of [
        {}, { name: " " }, { name: "x".repeat(151) }, { name: "x", description: [] },
        { name: "x", price_adjustment: Infinity }, { name: "x", price_adjustment: -100000001 },
        { name: "x", price_adjustment: "12" }, { name: "x", is_available: 0 }
    ]) {
        assert.ok(validateOptionPayload(body).errors.length);
    }
    assert.deepEqual(validateOptionPayload({ name: "  Light  " }), { data: { name: "Light" }, errors: [] });
    const patch = { price_adjustment: -100000000, description: null, is_available: false };
    assert.deepEqual(validateOptionPayload(patch, { partial: true }), { data: patch, errors: [] });
    assert.ok(validateOptionPayload({ meal_id: "1" }, { partial: true }).errors.length);
});

test("meal filters validate ranges, query types, sort and bounded pagination", () => {
    assert.deepEqual(validateMealListQuery({ available: ["false", "all"] }), {
        data: { search: "", sort: "id", available: true, page: 1, page_size: 20 }, errors: []
    });
    assert.equal(validateMealListQuery({}, true).data.available, undefined);
    assert.equal(validateMealListQuery({ available: "false" }, true).data.available, false);
    for (const query of [
        { min_calories: "2", max_calories: "1" }, { min_protein: "2", max_protein: "1" },
        { max_protein: "Infinity" }, { max_protein: "0x10" }, { min_protein: "-1" },
        { min_calories: ["0", "1"] }, { min_calories: "" }, { sort: "constructor" },
        { sort: "price" }, { page: "0" }, { page: "100001" }, { page_size: "1.2" },
        { page_size: "101" }, { search: "x".repeat(201) }, { search: ["a", "b"] },
        { meal_type: "CUT" }, { category_id: "9223372036854775808" }, { available: "no" }
    ]) {
        assert.ok(validateMealListQuery(query, true).errors.length, JSON.stringify(query));
    }
    assert.deepEqual(validateMealListQuery({
        min_calories: "0", max_protein: "15.5", category_id: "9223372036854775807",
        meal_type: "TOPPING", sort: "protein_desc", page: "100000", page_size: "100"
    }), {
        data: {
            search: "", sort: "protein_desc", available: true, page: 100000, page_size: 100,
            min_calories: 0, max_protein: 15.5, category_id: "9223372036854775807", meal_type: "TOPPING"
        },
        errors: []
    });
    assert.equal(validateMealPayload({ category_id: "9007199254740993" }, { partial: true }).data.category_id, "9007199254740993");
});

test("product list validates exact category and stock filters", () => {
    assert.deepEqual(validateProductListQuery({ category: " Tea ", in_stock: "true", available: "false" }), {
        data: { search: "", sort: "id", available: true, page: 1, page_size: 20, category: " Tea ", in_stock: true },
        errors: []
    });
    for (const query of [{ category: "x".repeat(101) }, { in_stock: "1" }, { sort: "protein_desc" }, { available: "no" }]) {
        assert.ok(validateProductListQuery(query, true).errors.length);
    }
});

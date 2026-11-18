const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateCategoryPayload } = require("../src/modules/category/category.validation");
const { validateProductListQuery, validateProductPayload, validateStockAdjustment } = require("../src/modules/product/product.validation");
const { validateId, validateMealListQuery, validateMealPayload } = require("../src/modules/meal/meal.validation");
const { catalogSearchPattern } = require("../src/modules/meal/catalog.service");
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

test("option macro adjustments accept finite signed numbers within each field's bounds", () => {
    const patch = {
        calories_adjustment: 80.25,
        protein_g_adjustment: -10000,
        carbs_g_adjustment: 0,
        fat_g_adjustment: 10000
    };
    assert.deepEqual(validateOptionPayload(patch, { partial: true }), { data: patch, errors: [] });
    for (const field of Object.keys(patch)) {
        for (const value of [Infinity, NaN, -10000.01, 10000.01, "0", null, false]) {
            assert.ok(validateOptionPayload({ [field]: value }, { partial: true }).errors.length, field);
        }
    }
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
        { meal_type: "CUT" }, { category_id: "9223372036854775808" }, { available: "no" },
        { goal_type: "cut" }, { goal_type: ["CUT", "BULK"] }, { goal_type: null }
    ]) {
        assert.ok(validateMealListQuery(query, true).errors.length, JSON.stringify(query));
    }
    assert.deepEqual(validateMealListQuery({
        min_calories: "0", max_protein: "15.5", category_id: "9223372036854775807",
        meal_type: "TOPPING", goal_type: "CUT", sort: "protein_desc", page: "100000", page_size: "100"
    }), {
        data: {
            search: "", sort: "protein_desc", available: true, page: 100000, page_size: 100,
            min_calories: 0, max_protein: 15.5, category_id: "9223372036854775807",
            meal_type: "TOPPING", goal_type: "CUT"
        },
        errors: []
    });
    assert.equal(validateMealPayload({ category_id: "9007199254740993" }, { partial: true }).data.category_id, "9007199254740993");
});

test("meal amounts accept decimal strings and enforce each numeric column's bounds", () => {
    const data = { name: "Bento", price: 9999999999.99, calories: 999999.99, protein_g: 0.5, carbs_g: 0, fat_g: 12 };
    const payload = { ...data, price: "9999999999.99", protein_g: ".5", carbs_g: "0" };
    assert.deepEqual(validateMealPayload(payload), { data, errors: [] });
    assert.deepEqual(validateMealPayload({ price: "65000" }, { partial: true }), { data: { price: 65000 }, errors: [] });

    for (const field of ["price", "calories", "protein_g", "carbs_g", "fat_g"]) {
        const max = field === "price" ? 9999999999.99 : 999999.99;
        for (const invalid of [null, "", "  ", true, [], {}, Infinity, NaN, "0x10", "1e2", -1, `-0.${"0".repeat(330)}1`]) {
            const error = [`${field} must be a non-negative number`];
            assert.deepEqual(validateMealPayload({ ...payload, [field]: invalid }).errors, error);
            assert.deepEqual(validateMealPayload({ [field]: invalid }, { partial: true }).errors, error);
        }
        for (const over of [max + 0.01, `${max}0000000000001`]) {
            assert.deepEqual(validateMealPayload({ [field]: over }, { partial: true }).errors, [
                `${field} must be at most ${max}`
            ]);
        }
        assert.deepEqual(validateMealPayload({ [field]: `${max}000` }, { partial: true }), {
            data: { [field]: max }, errors: []
        });
    }
});

test("meal identifiers and category filters require decimal integer syntax", () => {
    for (const invalid of ["0x1", "1e0", "1.0", " 1", "1 ", "1\n", "0", "9223372036854775808", true, ["1"]]) {
        assert.equal(validateId(invalid), null);
        assert.ok(validateMealListQuery({ category_id: invalid }).errors.length);
        assert.ok(validateMealPayload({ category_id: invalid }, { partial: true }).errors.length);
    }
    assert.equal(validateId("001"), "1");
    assert.equal(validateId(1), null);
    assert.equal(validateMealListQuery({ category_id: "001" }).data.category_id, "1");
    for (const category_id of [1, "9223372036854775807", null]) {
        assert.deepEqual(validateMealPayload({ category_id }, { partial: true }), { data: { category_id }, errors: [] });
    }
});

test("catalog search folds Vietnamese accents and escapes LIKE metacharacters", () => {
    for (const keyword of ["ỨC GÀ ĐẬU", "ức gà đậu".normalize("NFD"), "uc ga dau"]) {
        assert.equal(catalogSearchPattern(keyword), "%uc ga dau%");
    }
    assert.equal(catalogSearchPattern("Ức_%\\"), String.raw`%uc\_\%\\%`);
    assert.equal(catalogSearchPattern("\u0301"), "%\u0301%");
});

test("meal descriptions and image URLs reject embedded NUL characters but accept null", () => {
    const partial = { partial: true };
    for (const field of ["description", "image_url"]) {
        const invalid = validateMealPayload({ [field]: "before\0after" }, partial);
        assert.deepEqual(invalid.errors, [`${field} must be a string without NUL characters or null`]);
    }
    const data = { description: null, image_url: null };
    assert.deepEqual(validateMealPayload(data, partial), { data, errors: [] });
});

test("meal accepts valid goals and bounded allergen text, or null to clear either field", () => {
    const partial = { partial: true };
    for (const goal_type of ["BULK", "CUT", "MAINTAIN", null]) {
        const data = { goal_type, allergen_info: goal_type === null ? null : "x".repeat(500) };
        assert.deepEqual(validateMealPayload(data, partial), { data, errors: [] });
    }
    for (const payload of [
        { goal_type: "SINGLE" }, { goal_type: "" }, { goal_type: ["CUT"] },
        { allergen_info: "x".repeat(501) }, { allergen_info: "\0" }, { allergen_info: 1 }
    ]) {
        assert.ok(validateMealPayload(payload, partial).errors.length);
    }
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

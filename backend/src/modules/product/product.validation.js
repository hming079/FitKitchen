const {
    validText, validateListQuery, validateCatalogPayload, requiredName, nullableText, boolean
} = require("../meal/catalog.validation");

const maxStock = 2147483647;
const maxPrice = 9999999999.99;
const productFields = {
    name: requiredName(200),
    description: nullableText(),
    category: nullableText(100),
    image_url: nullableText(),
    price: value => Number.isFinite(value) && value >= 0 && value <= maxPrice
        ? null : `must be a number between 0 and ${maxPrice}`,
    stock_quantity: value => Number.isInteger(value) && value >= 0 && value <= maxStock
        ? null : `must be an integer between 0 and ${maxStock}`,
    unit: nullableText(50),
    is_available: boolean
};
const productSorts = {
    id: "id",
    price_asc: "price ASC, id",
    price_desc: "price DESC, id",
    newest: "created_at DESC NULLS LAST, id"
};

function validateProductListQuery(query, manage = false) {
    const { data, errors } = validateListQuery(query, productSorts, manage);
    if (query.category !== undefined) {
        if (validText(query.category, 100)) data.category = query.category;
        else errors.push("category must be a string of at most 100 characters");
    }
    if (query.in_stock !== undefined) {
        if (query.in_stock === "true" || query.in_stock === "false") data.in_stock = query.in_stock === "true";
        else errors.push("in_stock must be true or false");
    }
    return { data, errors };
}

function validateProductPayload(payload, { partial = false } = {}) {
    return validateCatalogPayload(payload, productFields, { partial, required: ["name", "price"] });
}

function validateStockAdjustment(payload) {
    const adjustment = payload?.adjustment;
    return Number.isInteger(adjustment) && adjustment !== 0 && Math.abs(adjustment) <= 1000000
        ? { data: adjustment, errors: [] }
        : { errors: ["adjustment must be a non-zero integer between -1000000 and 1000000"] };
}

module.exports = {
    productFields, productSorts, maxStock, validateProductListQuery, validateProductPayload, validateStockAdjustment
};

const {
    validateCatalogPayload, requiredName, nullableText, boolean
} = require("./catalog.validation");

const optionFields = {
    name: requiredName(150),
    description: nullableText(),
    price_adjustment: value => Number.isFinite(value) && Math.abs(value) <= 100000000
        ? null : "must be a number between -100000000 and 100000000",
    is_available: boolean
};

function validateOptionPayload(payload, { partial = false } = {}) {
    return validateCatalogPayload(payload, optionFields, { partial, required: ["name"] });
}

module.exports = { validateOptionPayload, optionFields };

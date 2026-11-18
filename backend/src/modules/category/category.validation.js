const { validateCatalogPayload, requiredName, nullableText } = require("../meal/catalog.validation");

const categoryFields = { name: requiredName(100), description: nullableText() };

function validateCategoryPayload(payload, { partial = false } = {}) {
    return validateCatalogPayload(payload, categoryFields, { partial, required: ["name"] });
}

module.exports = { validateCategoryPayload, categoryFields };

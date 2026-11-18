const {
    validateCatalogPayload, requiredName, nullableText, boolean
} = require("./catalog.validation");

const macroAdjustment = value => Number.isFinite(value) && Math.abs(value) <= 10000
    ? null : "must be a number between -10000 and 10000";

const optionFields = {
    name: requiredName(150),
    description: nullableText(),
    price_adjustment: value => Number.isFinite(value) && Math.abs(value) <= 100000000
        ? null : "must be a number between -100000000 and 100000000",
    calories_adjustment: macroAdjustment,
    protein_g_adjustment: macroAdjustment,
    carbs_g_adjustment: macroAdjustment,
    fat_g_adjustment: macroAdjustment,
    is_available: boolean
};

function validateOptionPayload(payload, { partial = false } = {}) {
    return validateCatalogPayload(payload, optionFields, { partial, required: ["name"] });
}

module.exports = { validateOptionPayload, optionFields };

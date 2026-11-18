const { validateCatalogId, validateListQuery, nullableText, validText } = require("./catalog.validation");

const mealTypes = new Set(["SINGLE", "COMBO_7_DAYS", "TOPPING"]);
const goalTypes = new Set(["BULK", "CUT", "MAINTAIN"]);
const goalTypeError = "goal_type must be BULK, CUT, or MAINTAIN";
const validateAllergens = nullableText(500);

const mealSorts = {
    id: "id",
    price_asc: "price ASC, id",
    price_desc: "price DESC, id",
    calories_asc: "calories ASC, id",
    calories_desc: "calories DESC, id",
    protein_desc: "protein_g DESC, id",
    newest: "created_at DESC NULLS LAST, id"
};

function validateMealListQuery(query, manage = false) {
    const { data, errors } = validateListQuery(query, mealSorts, manage);
    if (query.category_id !== undefined) {
        const categoryId = validateId(query.category_id);
        if (categoryId === null) errors.push("category_id must be a positive integer");
        else data.category_id = categoryId;
    }
    if (query.meal_type !== undefined) {
        if (!mealTypes.has(query.meal_type)) errors.push("meal_type must be SINGLE, COMBO_7_DAYS, or TOPPING");
        else data.meal_type = query.meal_type;
    }
    if (query.goal_type !== undefined) {
        if (!goalTypes.has(query.goal_type)) errors.push(goalTypeError);
        else data.goal_type = query.goal_type;
    }

    for (const metric of ["calories", "protein"]) {
        const min = `min_${metric}`;
        const max = `max_${metric}`;
        for (const field of [min, max]) {
            const raw = query[field];
            if (raw === undefined) continue;
            const value = Number(typeof raw === "string" ? raw : NaN);
            if (typeof raw !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) ||
                !Number.isFinite(value) || value < 0) {
                errors.push(`${field} must be a non-negative number`);
            } else {
                data[field] = value;
            }
        }
        if (data[min] > data[max]) errors.push(`${min} must be less than or equal to ${max}`);
    }

    return { data, errors };
}

const writableFields = [
    "category_id",
    "name",
    "description",
    "image_url",
    "price",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "meal_type",
    "goal_type",
    "allergen_info",
    "is_available"
];

function validateId(value) {
    return typeof value === "string" ? validateCatalogId(value) : null;
}

function validateMealPayload(payload, { partial = false } = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { errors: ["Request body must be an object"] };
    }

    const errors = [];
    const data = {};
    const numericFields = ["price", "calories", "protein_g", "carbs_g", "fat_g"];

    writableFields.forEach((field) => {
        if (payload[field] !== undefined) {
            data[field] = payload[field];
        }
    });

    if (!partial || payload.name !== undefined) {
        if (typeof payload.name !== "string" || payload.name.trim().length === 0) {
            errors.push("name is required");
        } else if (payload.name.trim().length > 200) {
            errors.push("name must be at most 200 characters");
        } else {
            data.name = payload.name.trim();
        }
    }

    for (const field of numericFields) {
        const raw = payload[field];
        if (partial && raw === undefined) continue;

        const value = typeof raw === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) ? Number(raw) : raw;
        const max = field === "price" ? 9999999999.99 : 999999.99;
        const negativeUnderflow = Object.is(value, -0) && typeof raw === "string" && /[1-9]/.test(raw);
        // A decimal string just over the limit can round down to the limit as a Number.
        const roundedToMax = value === max && typeof raw === "string" && /\.99\d*[1-9]\d*$/.test(raw);
        if (!Number.isFinite(value) || value < 0 || negativeUnderflow) {
            errors.push(`${field} must be a non-negative number`);
        } else if (value > max || roundedToMax) {
            errors.push(`${field} must be at most ${max}`);
        } else {
            data[field] = value;
        }
    }

    if (payload.category_id !== undefined) {
        if (payload.category_id === null) {
            data.category_id = null;
        } else {
            const categoryId = validateCatalogId(payload.category_id);
            if (categoryId === null) {
                errors.push("category_id must be a positive integer or null");
            } else {
                data.category_id = categoryId;
            }
        }
    }

    if (payload.meal_type !== undefined) {
        if (!mealTypes.has(payload.meal_type)) {
            errors.push("meal_type must be SINGLE, COMBO_7_DAYS, or TOPPING");
        }
    }
    if (payload.goal_type !== undefined && payload.goal_type !== null && !goalTypes.has(payload.goal_type)) {
        errors.push(`${goalTypeError} (or null)`);
    }
    if (payload.allergen_info !== undefined) {
        const error = validateAllergens(payload.allergen_info);
        if (error) errors.push(`allergen_info ${error}`);
    }

    if (payload.is_available !== undefined && typeof payload.is_available !== "boolean") {
        errors.push("is_available must be a boolean");
    }

    ["description", "image_url"].forEach((field) => {
        if (payload[field] !== undefined && payload[field] !== null && !validText(payload[field])) {
            errors.push(`${field} must be a string without NUL characters or null`);
        }
    });

    if (partial && Object.keys(data).length === 0 && errors.length === 0) {
        errors.push("At least one writable field is required");
    }

    return { data, errors };
}

module.exports = {
    mealTypes,
    mealSorts,
    writableFields,
    validateId,
    validateMealListQuery,
    validateMealPayload
};

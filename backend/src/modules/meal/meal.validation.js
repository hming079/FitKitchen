const { validateCatalogId, validateListQuery } = require("./catalog.validation");

const mealTypes = new Set(["SINGLE", "COMBO_7_DAYS", "TOPPING"]);

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
        const categoryId = typeof query.category_id === "string" ? validateId(query.category_id) : null;
        if (categoryId === null) errors.push("category_id must be a positive integer");
        else data.category_id = categoryId;
    }
    if (query.meal_type !== undefined) {
        if (!mealTypes.has(query.meal_type)) errors.push("meal_type must be SINGLE, COMBO_7_DAYS, or TOPPING");
        else data.meal_type = query.meal_type;
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
    "is_available"
];

function validateId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : validateCatalogId(value);
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

    if (!partial || payload.price !== undefined) {
        numericFields.forEach((field) => {
            if (payload[field] === undefined && partial) {
                return;
            }

            const value = Number(payload[field]);
            if (!Number.isFinite(value) || value < 0) {
                errors.push(`${field} must be a non-negative number`);
            } else {
                data[field] = value;
            }
        });
    } else {
        numericFields.slice(1).forEach((field) => {
            if (payload[field] === undefined) {
                return;
            }

            const value = Number(payload[field]);
            if (!Number.isFinite(value) || value < 0) {
                errors.push(`${field} must be a non-negative number`);
            } else {
                data[field] = value;
            }
        });
    }

    if (payload.category_id !== undefined) {
        if (payload.category_id === null) {
            data.category_id = null;
        } else {
            const categoryId = validateId(payload.category_id);
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

    if (payload.is_available !== undefined && typeof payload.is_available !== "boolean") {
        errors.push("is_available must be a boolean");
    }

    ["description", "image_url"].forEach((field) => {
        if (payload[field] !== undefined && payload[field] !== null &&
            typeof payload[field] !== "string") {
            errors.push(`${field} must be a string or null`);
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

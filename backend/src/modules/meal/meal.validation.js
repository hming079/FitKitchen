const mealTypes = new Set(["SINGLE", "COMBO_7_DAYS", "TOPPING"]);

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
    return Number.isInteger(id) && id > 0 ? id : null;
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
    writableFields,
    validateId,
    validateMealPayload
};

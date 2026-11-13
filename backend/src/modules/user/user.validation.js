const fitnessGoals = new Set(["BULK", "CUT", "MAINTAIN"]);
const roles = new Set(["CUSTOMER", "ADMIN"]);

function validateId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function validateEmail(value) {
    return typeof value === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateUserPayload(payload, { partial = false } = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { errors: ["Request body must be an object"] };
    }

    const errors = [];
    const data = {};
    const requiredFields = ["email", "full_name"];

    if (!partial || payload.email !== undefined) {
        if (!validateEmail(payload.email)) {
            errors.push("email must be a valid email address");
        } else {
            data.email = payload.email.trim().toLowerCase();
        }
    }

    if (!partial || payload.full_name !== undefined) {
        if (typeof payload.full_name !== "string" || payload.full_name.trim().length === 0) {
            errors.push("full_name is required");
        } else if (payload.full_name.trim().length > 150) {
            errors.push("full_name must be at most 150 characters");
        } else {
            data.full_name = payload.full_name.trim();
        }
    }

    if (!partial || payload.password !== undefined) {
        if (typeof payload.password !== "string" || payload.password.length < 8) {
            errors.push("password must be at least 8 characters");
        } else {
            data.password = payload.password;
        }
    }

    if (payload.phone !== undefined) {
        if (payload.phone !== null && typeof payload.phone !== "string") {
            errors.push("phone must be a string or null");
        } else {
            data.phone = payload.phone === null ? null : payload.phone.trim();
        }
    }

    if (payload.fitness_goal !== undefined) {
        if (payload.fitness_goal !== null && !fitnessGoals.has(payload.fitness_goal)) {
            errors.push("fitness_goal must be BULK, CUT, MAINTAIN, or null");
        } else {
            data.fitness_goal = payload.fitness_goal;
        }
    }

    if (payload.target_calories !== undefined) {
        if (payload.target_calories !== null) {
            const calories = Number(payload.target_calories);
            if (!Number.isFinite(calories) || calories < 0) {
                errors.push("target_calories must be a non-negative number or null");
            } else {
                data.target_calories = calories;
            }
        } else {
            data.target_calories = null;
        }
    }

    if (payload.role !== undefined) {
        if (!roles.has(payload.role)) {
            errors.push("role must be CUSTOMER or ADMIN");
        } else {
            data.role = payload.role;
        }
    }

    if (partial && Object.keys(data).length === 0 && errors.length === 0) {
        errors.push("At least one writable field is required");
    }

    if (!partial && !Object.prototype.hasOwnProperty.call(payload, "password")) {
        errors.push("password is required");
    }

    return { data, errors };
}

function validateAddressPayload(payload, { partial = false } = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { errors: ["Request body must be an object"] };
    }

    const errors = [];
    const data = {};
    const fields = ["recipient_name", "phone", "address_detail"];

    fields.forEach((field) => {
        if (!partial || payload[field] !== undefined) {
            if (typeof payload[field] !== "string" || payload[field].trim().length === 0) {
                errors.push(`${field} is required`);
            } else {
                data[field] = payload[field].trim();
            }
        }
    });

    if (payload.is_default !== undefined) {
        if (typeof payload.is_default !== "boolean") {
            errors.push("is_default must be a boolean");
        } else {
            data.is_default = payload.is_default;
        }
    }

    if (partial && Object.keys(data).length === 0 && errors.length === 0) {
        errors.push("At least one writable field is required");
    }

    return { data, errors };
}

module.exports = {
    fitnessGoals,
    roles,
    validateAddressPayload,
    validateId,
    validateUserPayload
};

const maxId = "9223372036854775807";

function validateCatalogId(value) {
    if (Number.isSafeInteger(value) && value > 0) return value;
    if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
    const id = value.replace(/^0+/, "");
    return id && (id.length < maxId.length || (id.length === maxId.length && id <= maxId))
        ? id
        : null;
}

function validText(value, max = Infinity) {
    return typeof value === "string" && !value.includes("\0") &&
        (value.length <= max || (value.length <= 2 * max && [...value].length <= max));
}

function validateListQuery(query, sorts, manage) {
    const errors = [];
    const data = { available: true };
    const { search = "", sort = "id" } = query;

    if (validText(search, 200)) data.search = search.trim();
    else errors.push("search must be a string of at most 200 characters");

    if (typeof sort === "string" && Object.hasOwn(sorts, sort)) data.sort = sort;
    else errors.push(`sort must be one of: ${Object.keys(sorts).join(", ")}`);

    if (manage) {
        const { available = "all" } = query;
        if (available === "all") data.available = undefined;
        else if (available === "true" || available === "false") data.available = available === "true";
        else errors.push("available must be true, false, or all");
    }

    for (const [key, fallback, max] of [["page", 1, 100000], ["page_size", 20, 100]]) {
        const value = query[key];
        if (value === undefined) data[key] = fallback;
        else if (typeof value === "string" && /^\d+$/.test(value) &&
            Number(value) >= 1 && Number(value) <= max) data[key] = Number(value);
        else errors.push(`${key} must be an integer between 1 and ${max}`);
    }

    return { data, errors };
}

function validateCatalogPayload(payload, fields, { partial = false, required = [] } = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { errors: ["Request body must be an object"] };
    }

    const data = {};
    const errors = [];
    for (const [field, validate] of Object.entries(fields)) {
        const value = payload[field];
        if (value === undefined && (partial || !required.includes(field))) continue;
        const normalized = field === "name" && typeof value === "string" ? value.trim() : value;
        const error = validate(normalized);
        if (error) errors.push(`${field} ${error}`);
        else data[field] = normalized;
    }

    if (partial && !errors.length && !Object.keys(data).length) {
        errors.push("At least one writable field is required");
    }

    return { data, errors };
}

const requiredName = max => value =>
    validText(value, max) && value.length > 0 ? null : `must contain 1–${max} characters`;
const nullableText = (max = Infinity) => value =>
    value === null || validText(value, max) ? null :
        (max === Infinity ? "must be a string or null" : `must be a string of at most ${max} characters or null`);
const boolean = value => typeof value === "boolean" ? null : "must be a boolean";

module.exports = {
    validateCatalogId,
    validText,
    validateListQuery,
    validateCatalogPayload,
    requiredName,
    nullableText,
    boolean
};

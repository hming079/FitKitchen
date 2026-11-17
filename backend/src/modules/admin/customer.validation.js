function invalid(message) {
    const error = new Error(message);
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
}

function customerId(value) {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || BigInt(value) > 9223372036854775807n) {
        invalid('id must be a positive bigint');
    }
    return value;
}

function parseListQuery(query) {
    const search = query.search ?? '';
    const status = query.status ?? 'all';
    if (typeof search !== 'string' || search.length > 200) invalid('search must be at most 200 characters');
    if (!['all', 'active', 'locked'].includes(status)) invalid('status must be all, active or locked');
    function integer(value, fallback, max) {
        if (value === undefined) return fallback;
        if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) invalid('Invalid pagination');
        return Number(value);
    }
    return { search: search.trim(), status, page: integer(query.page, 1, 100000), page_size: integer(query.page_size, 20, 100) };
}

function validateStatus(body) {
    if (!body || Array.isArray(body) || typeof body !== 'object') invalid('Request body must be an object');
    if (Object.keys(body).some(key => !['is_locked', 'reason', 'confirm_unfinished_orders'].includes(key))) invalid('Unknown status field');
    if (typeof body.is_locked !== 'boolean') invalid('is_locked must be a boolean');
    if (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 1000) invalid('reason must contain 1–1000 characters');
    if (body.confirm_unfinished_orders !== undefined && typeof body.confirm_unfinished_orders !== 'boolean') invalid('confirm_unfinished_orders must be a boolean');
    return { is_locked: body.is_locked, reason: body.reason.trim(), confirm_unfinished_orders: body.confirm_unfinished_orders ?? false };
}

module.exports = { parseListQuery, validateStatus, customerId };

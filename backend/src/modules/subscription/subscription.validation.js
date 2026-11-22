const MAX_BIGINT = 9223372036854775807n;

// Business rules shared by checkout validation and the public checkout window.
const MIN_LEAD_DAYS = 1; // The kitchen needs at least one day to prepare the first delivery.
const MAX_LEAD_DAYS = 30; // Customers can schedule a start date up to 30 days ahead.
const PAYMENT_METHODS = ['COD']; // Online payment is not integrated yet.
const LIMITS = {
    name: 200,
    description: 2000,
    durationDays: 365,
    mealsPerDay: 6,
    price: 9999999999.99,
    gifts: 10,
    giftName: 200,
    giftDescription: 1000,
    giftQuantity: 100,
    search: 200
};
const ADMIN_VIEWS = ['all', 'in_progress', 'upcoming', 'pending', 'ended', 'cancelled'];

function invalid(message) {
    const error = new Error(message);
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    return error;
}

function requireObject(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Request body must be an object');
}

function onlyKeys(body, keys) {
    const unknown = Object.keys(body).find(key => !keys.includes(key));
    if (unknown) throw invalid(`Unknown field: ${unknown}`);
}

function positiveId(value, field = 'id') {
    const text = Number.isSafeInteger(value) ? String(value) : value;
    if (typeof text !== 'string' || !/^[1-9]\d*$/.test(text) || BigInt(text) > MAX_BIGINT) {
        throw invalid(`${field} must be a positive integer`);
    }
    return text;
}

// Calendar dates stay strings so no timezone conversion can shift the day.
function calendarDate(value, field) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw invalid(`${field} must be a date in YYYY-MM-DD format`);
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw invalid(`${field} is not a valid calendar date`);
    }
    return value;
}

function text(value, field, max, { required = false } = {}) {
    if (value === null && !required) return null;
    if (typeof value !== 'string' || value.includes('\0')) throw invalid(`${field} must be a string`);
    const trimmed = value.trim();
    if (required && !trimmed) throw invalid(`${field} is required`);
    if ([...trimmed].length > max) throw invalid(`${field} must be at most ${max} characters`);
    return trimmed || null;
}

function integer(value, field, min, max) {
    if (!Number.isInteger(value) || value < min || value > max) {
        throw invalid(`${field} must be a whole number between ${min} and ${max}`);
    }
    return value;
}

function price(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > LIMITS.price ||
        Math.abs(Math.round(value * 100) - value * 100) > 1e-6) {
        throw invalid('price must be a non-negative amount with at most 2 decimal places');
    }
    return value;
}

function validateGifts(value) {
    if (!Array.isArray(value)) throw invalid('gifts must be an array');
    if (value.length > LIMITS.gifts) throw invalid(`A plan can include at most ${LIMITS.gifts} gifts`);
    return value.map((gift, index) => {
        const label = `gifts[${index}]`;
        requireObject(gift);
        onlyKeys(gift, ['product_id', 'gift_name', 'description', 'quantity']);
        return {
            product_id: gift.product_id === undefined || gift.product_id === null
                ? null : positiveId(gift.product_id, `${label}.product_id`),
            gift_name: text(gift.gift_name, `${label}.gift_name`, LIMITS.giftName, { required: true }),
            description: gift.description === undefined
                ? null : text(gift.description, `${label}.description`, LIMITS.giftDescription),
            quantity: integer(gift.quantity ?? 1, `${label}.quantity`, 1, LIMITS.giftQuantity)
        };
    });
}

const planFields = {
    name: value => text(value, 'name', LIMITS.name, { required: true }),
    description: value => text(value, 'description', LIMITS.description),
    duration_days: value => integer(value, 'duration_days', 1, LIMITS.durationDays),
    meals_per_day: value => integer(value, 'meals_per_day', 1, LIMITS.mealsPerDay),
    price,
    is_active: value => {
        if (typeof value !== 'boolean') throw invalid('is_active must be a boolean');
        return value;
    },
    gifts: validateGifts
};

function validatePlan(body, { partial = false } = {}) {
    requireObject(body);
    onlyKeys(body, Object.keys(planFields));
    const data = {};
    for (const [field, validate] of Object.entries(planFields)) {
        if (body[field] === undefined) {
            if (!partial && ['name', 'duration_days', 'meals_per_day', 'price'].includes(field)) {
                throw invalid(`${field} is required`);
            }
            continue;
        }
        data[field] = validate(body[field]);
    }
    if (!partial) {
        data.is_active ??= true;
        data.gifts ??= [];
    }
    if (partial && !Object.keys(data).length) throw invalid('At least one writable field is required');
    return data;
}

function validateCheckout(body) {
    requireObject(body);
    onlyKeys(body, ['plan_id', 'start_date', 'address_id', 'payment_method']);
    const paymentMethod = body.payment_method ?? 'COD';
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
        throw invalid(`payment_method must be one of: ${PAYMENT_METHODS.join(', ')}`);
    }
    return {
        plan_id: positiveId(body.plan_id, 'plan_id'),
        address_id: positiveId(body.address_id, 'address_id'),
        start_date: calendarDate(body.start_date, 'start_date'),
        payment_method: paymentMethod
    };
}

function pageNumber(value, fallback, max) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw invalid('Invalid pagination');
    return Number(value);
}

function parseAdminListQuery(query) {
    const search = query.search ?? '';
    const view = query.view ?? 'all';
    if (typeof search !== 'string' || [...search].length > LIMITS.search) {
        throw invalid(`search must be at most ${LIMITS.search} characters`);
    }
    if (!ADMIN_VIEWS.includes(view)) throw invalid(`view must be one of: ${ADMIN_VIEWS.join(', ')}`);
    return {
        search: search.trim(),
        view,
        plan_id: query.plan_id === undefined || query.plan_id === 'all' ? null : positiveId(query.plan_id, 'plan_id'),
        page: pageNumber(query.page, 1, 100000),
        page_size: pageNumber(query.page_size, 20, 100)
    };
}

function validateSubscriptionUpdate(body) {
    requireObject(body);
    onlyKeys(body, ['status', 'payment_status']);
    if (body.status === undefined && body.payment_status === undefined) {
        throw invalid('status or payment_status is required');
    }
    if (body.status !== undefined && !['ACTIVE', 'CANCELLED'].includes(body.status)) {
        throw invalid('status must be ACTIVE or CANCELLED');
    }
    if (body.payment_status !== undefined && body.payment_status !== 'PAID') {
        throw invalid('payment_status must be PAID');
    }
    return { status: body.status ?? null, payment_status: body.payment_status ?? null };
}

module.exports = {
    MIN_LEAD_DAYS,
    MAX_LEAD_DAYS,
    PAYMENT_METHODS,
    LIMITS,
    ADMIN_VIEWS,
    positiveId,
    calendarDate,
    validatePlan,
    validateCheckout,
    parseAdminListQuery,
    validateSubscriptionUpdate
};

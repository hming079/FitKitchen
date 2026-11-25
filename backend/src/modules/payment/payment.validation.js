const { positiveId } = require('../order/order.validation');

function invalid(message) {
    throw Object.assign(new Error(message), { status: 400, code: 'VALIDATION_ERROR' });
}

// POST /api/payments/vnpay body: { order_id }. The amount always comes from the database.
function validateCreatePayment(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Request body must be an object');
    if (Object.keys(body).some(key => key !== 'order_id')) invalid('Request contains unsupported fields');
    return { order_id: positiveId(body.order_id, 'order_id') };
}

module.exports = { validateCreatePayment, positiveId };

const service = require('./payment.service');
const vnpay = require('./vnpay');
const { validateCreatePayment } = require('./payment.validation');

// The shared error handler turns 5xx into INTERNAL_ERROR, so 503 is answered here.
function notConfigured(res) {
    return res.status(503).json({
        success: false,
        code: 'PAYMENT_NOT_CONFIGURED',
        message: 'Online payment is not configured'
    });
}

module.exports = {
    async createVnpay(req, res) {
        const { order_id } = validateCreatePayment(req.body);
        if (!vnpay.loadConfig()) return notConfigured(res);
        const data = await service.createVnpayUrl({ userId: req.user.id, orderId: order_id, ip: req.ip });
        return res.json({ success: true, data });
    }
};

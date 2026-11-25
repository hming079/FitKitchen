const service = require('./payment.service');
const vnpay = require('./vnpay');
const { validateCreatePayment, positiveId } = require('./payment.validation');

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
    },

    // Always HTTP 200 with { RspCode, Message }; errors never reach the shared handler.
    async vnpayIpn(req, res) {
        let result;
        try {
            result = await service.handleIpn(req.query || {});
        } catch (error) {
            console.error('VNPay IPN failed:', error.code || error.name);
            result = service.IPN.UNKNOWN;
        }
        return res.status(200).json(result);
    },

    // Redirects the browser to PAYMENT_RESULT_URL; any failure becomes result=invalid.
    vnpayReturn(req, res) {
        const config = vnpay.loadConfig();
        if (!config) return notConfigured(res);
        let location;
        try {
            location = service.returnRedirectUrl(config, req.query || {});
        } catch (error) {
            console.error('VNPay return failed:', error.code || error.name);
            location = service.invalidRedirectUrl(config);
        }
        return res.redirect(302, location);
    },

    async paymentStatus(req, res) {
        const orderId = positiveId(req.params.orderId, 'orderId');
        return res.json({ success: true, data: await service.paymentStatus(req.user.id, orderId) });
    }
};

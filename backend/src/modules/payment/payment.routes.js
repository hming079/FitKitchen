const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const controller = require('./payment.controller');

const customer = [authenticate, requireRole('CUSTOMER')];

router.post('/vnpay', ...customer, controller.createVnpay);
// Called by VNPay servers; authenticity comes from the HMAC signature, not a session.
router.get('/vnpay/ipn', controller.vnpayIpn);

module.exports = router;

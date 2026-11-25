const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const controller = require('./payment.controller');

const customer = [authenticate, requireRole('CUSTOMER')];

router.post('/vnpay', ...customer, controller.createVnpay);

module.exports = router;

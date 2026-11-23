const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { positiveId, validateCheckout } = require('./subscription.validation');
const service = require('./subscription.service');

const customer = [authenticate, requireRole('CUSTOMER')];

// Public catalog: active plans, their template gifts and the allowed start-date window.
router.get('/subscription-plans', async (req, res) => {
    res.json({ success: true, ...await service.listPublicPlans() });
});
router.get('/subscription-plans/:id', async (req, res) => {
    res.json({ success: true, ...await service.findPublicPlan(positiveId(req.params.id)) });
});

// Customer area: the signed-in customer only ever reads or creates their own subscriptions.
router.get('/subscriptions/me', ...customer, async (req, res) => {
    res.json({ success: true, data: await service.listCustomerSubscriptions(req.user.id) });
});
router.post('/subscriptions/checkout', ...customer, async (req, res) => {
    res.status(201).json({ success: true, data: await service.checkout(req.user.id, validateCheckout(req.body)) });
});

module.exports = router;

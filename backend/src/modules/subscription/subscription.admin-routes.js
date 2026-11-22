// Mounted inside the Admin module, which already requires an authenticated ADMIN.
const router = require('express').Router();
const {
    positiveId,
    validatePlan,
    parseAdminListQuery,
    validateSubscriptionUpdate
} = require('./subscription.validation');
const service = require('./subscription.service');

router.get('/subscription-plans', async (req, res) => {
    res.json({ success: true, data: await service.listAdminPlans() });
});
router.post('/subscription-plans', async (req, res) => {
    res.status(201).json({ success: true, data: await service.createPlan(validatePlan(req.body)) });
});
router.patch('/subscription-plans/:id', async (req, res) => {
    const id = positiveId(req.params.id);
    res.json({ success: true, data: await service.updatePlan(id, validatePlan(req.body, { partial: true })) });
});

router.get('/subscriptions', async (req, res) => {
    res.json({ success: true, ...await service.listAdminSubscriptions(parseAdminListQuery(req.query)) });
});
router.patch('/subscriptions/:id', async (req, res) => {
    const id = positiveId(req.params.id);
    res.json({ success: true, ...await service.updateSubscription(id, validateSubscriptionUpdate(req.body)) });
});

module.exports = router;

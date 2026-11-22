const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { customerId, parseListQuery, validateStatus } = require('./customer.validation');
const service = require('./customer.service');
const { adminRouter: subscriptionAdminRouter } = require('../subscription');

router.use(authenticate, requireRole('ADMIN'));
router.use(subscriptionAdminRouter);
router.get('/customers', async (req, res) => {
    res.json({ success: true, ...await service.list(parseListQuery(req.query)) });
});
router.get('/customers/:id', async (req, res) => {
    res.json({ success: true, data: await service.profile(customerId(req.params.id)) });
});
for (const kind of ['orders', 'subscriptions']) {
    router.get(`/customers/:id/${kind}`, async (req, res) => {
        res.json({ success: true, ...await service.history(customerId(req.params.id), kind, parseListQuery(req.query)) });
    });
}
router.patch('/customers/:id/status', async (req, res) => {
    res.json({ success: true, ...await service.changeStatus(customerId(req.params.id), req.user.id, validateStatus(req.body)) });
});

module.exports = { basePath: '/api/admin', router };

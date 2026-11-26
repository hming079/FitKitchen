const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { customerId, parseListQuery, validateStatus } = require('./customer.validation');
const service = require('./customer.service');
const operations = require('./operations.service');
const { positiveId, validatePage } = require('../order/order.validation');
const { adminRouter: subscriptionAdminRouter } = require('../subscription');
const { adminRouter: promotionAdminRouter } = require('../promotion');

router.use(authenticate, requireRole('ADMIN'));
router.use(subscriptionAdminRouter);
router.use(promotionAdminRouter);
router.get('/overview', async (req, res) => {
    res.json({ success: true, data: await operations.overview(req.query) });
});
router.get('/orders', async (req, res) => {
    res.json({ success: true, ...await operations.listOrders(req.query.search ?? '', validatePage(req.query)) });
});
router.get('/orders/:id', async (req, res) => {
    res.json({ success: true, data: await operations.orderDetails(positiveId(req.params.id, 'id')) });
});
router.patch('/orders/:id/status', async (req, res) => {
    res.json({ success: true, data: await operations.updateStatus(positiveId(req.params.id, 'id'), req.body) });
});
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

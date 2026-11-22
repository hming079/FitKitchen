module.exports = {
    name: 'subscriptions',
    basePath: '/api',
    router: require('./subscription.routes'),
    adminRouter: require('./subscription.admin-routes')
};

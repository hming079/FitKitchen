
const express = require("express");
const cors = require("cors");
const mealModule = require("./modules/meal");
const categoryModule = require("./modules/category");
const productModule = require("./modules/product");
const userModule = require("./modules/user");
const authModule = require("./modules/auth");
const adminModule = require("./modules/admin");
const subscriptionModule = require("./modules/subscription");
const orderModule = require("./modules/order");
const paymentModule = require("./modules/payment");
const nutritionModule = require("./modules/nutrition");
const promotionModule = require("./modules/promotion");
const { authenticate } = require("./middleware/auth");
const { securityHeaders, createRateLimiter } = require("./middleware/security");

const app = express();

app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors({ origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(origin => origin.trim()) }));
app.use(express.json({ limit: "32kb" }));

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "EatClean API is running"
    });
});

app.use(mealModule.basePath, mealModule.router);
app.use(promotionModule.basePath, promotionModule.customerRouter);
app.use(categoryModule.basePath, categoryModule.router);
app.use(productModule.basePath, productModule.router);
app.use(userModule.basePath, userModule.router);
app.post("/api/auth/login", createRateLimiter());
app.use(authModule.basePath, authModule.router);
app.use(adminModule.basePath, adminModule.router);
app.use(subscriptionModule.basePath, subscriptionModule.router);
app.use(orderModule.basePath, orderModule.router);
app.use(paymentModule.basePath, paymentModule.router);
app.use(nutritionModule.basePath, nutritionModule.router);
app.get('/api/session', authenticate, (req, res) => res.json({ success: true, data: req.user }));

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error('API request failed:', error.code || error.name);
    return res.status(status).json({
        success: false,
        code: status === 500 ? 'INTERNAL_ERROR' : (error.code || 'VALIDATION_ERROR'),
        message: status === 500 ? 'Internal server error' : error.message,
        ...(error.unfinished_order_count !== undefined ? { unfinished_order_count: error.unfinished_order_count } : {})
    });
});

module.exports = app;

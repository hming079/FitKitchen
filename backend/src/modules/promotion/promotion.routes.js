const express = require("express");
const { authenticate, requireRole } = require("../../middleware/auth");
const controller = require("./promotion.controller");

const customerRouter = express.Router();
customerRouter.post("/validate", authenticate, requireRole("CUSTOMER"), controller.validateCart);

const adminRouter = express.Router();
adminRouter.get("/promotions", controller.list);
adminRouter.post("/promotions", controller.create);
adminRouter.patch("/promotions/:id", controller.update);

module.exports = { customerRouter, adminRouter };

const router = require("express").Router();
const { authenticate, requireRole } = require("../../middleware/auth");
const controller = require("./order.controller");

const customer = [authenticate, requireRole("CUSTOMER")];

router.get("/cart", ...customer, controller.getCart);
router.post("/cart/items", ...customer, controller.addCartItem);
router.patch("/cart/items/:itemId", ...customer, controller.updateCartItem);
router.delete("/cart/items/:itemId", ...customer, controller.removeCartItem);
router.delete("/cart", ...customer, controller.clearCart);
router.post("/orders/checkout", ...customer, controller.checkout);
router.get("/orders", ...customer, controller.listOrders);
router.patch("/orders/:id/cancel", ...customer, controller.cancelOrder);
router.get("/orders/:id", ...customer, controller.getOrder);

module.exports = router;

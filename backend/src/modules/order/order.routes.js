const router = require("express").Router();
const { authenticate, requireRole } = require("../../middleware/auth");
const controller = require("./order.controller");

router.use(authenticate, requireRole("CUSTOMER"));
router.get("/cart", controller.getCart);
router.post("/cart/items", controller.addCartItem);
router.patch("/cart/items/:itemId", controller.updateCartItem);
router.delete("/cart/items/:itemId", controller.removeCartItem);
router.delete("/cart", controller.clearCart);
router.post("/orders/checkout", controller.checkout);
router.get("/orders", controller.listOrders);
router.get("/orders/:id", controller.getOrder);

module.exports = router;

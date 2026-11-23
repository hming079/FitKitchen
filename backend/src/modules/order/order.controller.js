const service = require("./order.service");
const {
  validateCartItem,
  validateCheckout,
  validatePage,
  positiveId,
} = require("./order.validation");

function createOrderController() {
  return {
    async getCart(req, res) {
      return res.json({
        success: true,
        data: await service.listCart(req.user.id),
      });
    },
    async addCartItem(req, res) {
      const data = validateCartItem(req.body);
      return res
        .status(201)
        .json({
          success: true,
          data: await service.addCartItem(req.user.id, data),
        });
    },
    async updateCartItem(req, res) {
      const id = positiveId(req.params.itemId, "itemId");
      const data = validateCartItem(req.body, { partial: true });
      return res.json({
        success: true,
        data: await service.updateCartItem(req.user.id, id, data.quantity),
      });
    },
    async removeCartItem(req, res) {
      const id = positiveId(req.params.itemId, "itemId");
      return res.json({
        success: true,
        data: await service.removeCartItem(req.user.id, id),
      });
    },
    async clearCart(req, res) {
      return res.json({
        success: true,
        data: await service.clearCart(req.user.id),
      });
    },
    async checkout(req, res) {
      const data = validateCheckout(req.body);
      return res
        .status(201)
        .json({
          success: true,
          data: await service.checkout(req.user.id, data),
        });
    },
    async listOrders(req, res) {
      return res.json({
        success: true,
        ...(await service.listOrders(req.user.id, validatePage(req.query))),
      });
    },
    async getOrder(req, res) {
      const id = positiveId(req.params.id, "id");
      const order = await service.getOrder(req.user.id, id);
      if (!order)
        return res
          .status(404)
          .json({
            success: false,
            code: "ORDER_NOT_FOUND",
            message: "Order not found",
          });
      return res.json({ success: true, data: order });
    },
  };
}

module.exports = createOrderController();

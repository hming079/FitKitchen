const orderService = require("../order/order.service");
const promotionService = require("./promotion.service");
const { validateCodeBody, validatePromotion } = require("./promotion.validation");
const { positiveId, validatePage } = require("../order/order.validation");

module.exports = {
  async validateCart(req, res) {
    const { code } = validateCodeBody(req.body);
    const cart = await orderService.listCart(req.user.id);
    return res.json({
      success: true,
      data: await promotionService.validateForCart(req.user.id, code, cart.subtotal),
    });
  },
  async list(req, res) {
    return res.json({ success: true, ...(await promotionService.listAdmin(validatePage(req.query))) });
  },
  async create(req, res) {
    const input = validatePromotion(req.body);
    return res.status(201).json({ success: true, data: await promotionService.createPromotion(input) });
  },
  async update(req, res) {
    const id = positiveId(req.params.id, "id");
    const patch = validatePromotion(req.body, { partial: true });
    return res.json({
      success: true,
      data: await promotionService.updatePromotion(id, patch),
    });
  },
};

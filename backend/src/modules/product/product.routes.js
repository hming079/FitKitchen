const express = require("express");
const controller = require("./product.controller");
const { authenticate, requireRole } = require("../../middleware/auth");

const router = express.Router();
const admin = [authenticate, requireRole("ADMIN")];

router.get("/", (req, res) => controller.list(req, res));
router.get("/manage", ...admin, (req, res) => controller.list(req, res, true));
router.get("/:id", controller.getById);
router.post("/", ...admin, controller.create);
router.patch("/:id", ...admin, (req, res) => controller.update(req, res));
router.delete("/:id", ...admin, (req, res) => controller.update(req, res, true));
router.patch("/:id/stock", ...admin, controller.adjustStock);

module.exports = router;

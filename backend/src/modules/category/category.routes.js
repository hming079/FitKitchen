const express = require("express");
const controller = require("./category.controller");
const { authenticate, requireRole } = require("../../middleware/auth");

const router = express.Router();
const admin = [authenticate, requireRole("ADMIN")];

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", ...admin, controller.create);
router.patch("/:id", ...admin, controller.update);
router.delete("/:id", ...admin, controller.remove);

module.exports = router;

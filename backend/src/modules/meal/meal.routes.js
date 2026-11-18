const express = require("express");
const mealController = require("./meal.controller");
const { authenticate, requireRole } = require('../../middleware/auth');

const router = express.Router();
const admin = [authenticate, requireRole('ADMIN')];

router.get("/", (req, res) => mealController.list(req, res));
router.get("/manage", ...admin, (req, res) => mealController.list(req, res, true));
router.post("/", ...admin, mealController.create);
router.get("/:id/customizations", (req, res) => mealController.getCustomizations(req, res));
router.get("/:id/customizations/manage", ...admin, (req, res) => mealController.getCustomizations(req, res, true));
router.post("/:id/customizations", ...admin, mealController.createCustomization);
router.patch("/:id/customizations/:optionId", ...admin, (req, res) => mealController.updateCustomization(req, res));
router.delete("/:id/customizations/:optionId", ...admin, (req, res) => mealController.updateCustomization(req, res, true));
router.get("/:id", mealController.getById);
router.patch("/:id", ...admin, mealController.update);
router.delete("/:id", ...admin, mealController.archive);

module.exports = router;

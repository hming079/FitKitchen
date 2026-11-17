const express = require("express");
const mealController = require("./meal.controller");
const { authenticate, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.get("/", mealController.list.bind(mealController));
router.post("/", authenticate, requireRole('ADMIN'), mealController.create.bind(mealController));
router.get("/:id/customizations", mealController.getCustomizations.bind(mealController));
router.get("/:id", mealController.getById.bind(mealController));
router.patch("/:id", authenticate, requireRole('ADMIN'), mealController.update.bind(mealController));
router.delete("/:id", authenticate, requireRole('ADMIN'), mealController.archive.bind(mealController));

module.exports = router;

const express = require("express");
const mealController = require("./meal.controller");

const router = express.Router();

router.get("/", mealController.list.bind(mealController));
router.post("/", mealController.create.bind(mealController));
router.get("/:id/customizations", mealController.getCustomizations.bind(mealController));
router.get("/:id", mealController.getById.bind(mealController));
router.patch("/:id", mealController.update.bind(mealController));
router.delete("/:id", mealController.archive.bind(mealController));

module.exports = router;

const express = require("express");
const userController = require("./user.controller");

const router = express.Router();

router.get("/", userController.list.bind(userController));
router.post("/", userController.create.bind(userController));
router.get("/:userId/addresses", userController.listAddresses.bind(userController));
router.post("/:userId/addresses", userController.createAddress.bind(userController));
router.patch("/:userId/addresses/:addressId", userController.updateAddress.bind(userController));
router.delete("/:userId/addresses/:addressId", userController.removeAddress.bind(userController));
router.get("/:id", userController.getById.bind(userController));
router.patch("/:id", userController.update.bind(userController));
router.delete("/:id", userController.remove.bind(userController));

module.exports = router;

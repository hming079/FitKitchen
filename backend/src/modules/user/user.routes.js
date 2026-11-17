const express = require("express");
const userController = require("./user.controller");
const { authenticate, requireRole, requireSelf } = require('../../middleware/auth');

const router = express.Router();

router.get("/", authenticate, requireRole('ADMIN'), userController.list.bind(userController));
router.post("/", userController.create.bind(userController));
router.use(authenticate);
router.use('/:userId/addresses', requireSelf('userId'));
router.get("/:userId/addresses", userController.listAddresses.bind(userController));
router.post("/:userId/addresses", userController.createAddress.bind(userController));
router.patch("/:userId/addresses/:addressId", userController.updateAddress.bind(userController));
router.delete("/:userId/addresses/:addressId", userController.removeAddress.bind(userController));
router.get("/:id", requireSelf('id'), userController.getById.bind(userController));
router.patch("/:id", requireSelf('id'), userController.update.bind(userController));
// Account deletion is outside this task; keep it admin-only. Audit FKs retain history.
router.delete("/:id", requireRole('ADMIN'), userController.remove.bind(userController));

module.exports = router;

const router = require("express").Router();
const { authenticate, requireRole } = require("../../middleware/auth");
const controller = require("./nutrition.controller");

router.use(authenticate, requireRole("CUSTOMER"));
router.get("/profile", controller.getProfile);
router.put("/profile", controller.saveProfile);

module.exports = router;

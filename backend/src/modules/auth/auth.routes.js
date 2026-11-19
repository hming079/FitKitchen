const express = require("express");
const authController = require("./auth.controller");
const { authenticate } = require("../../middleware/auth");

const router = express.Router();

router.post("/login", authController.login.bind(authController));
router.post("/logout", authenticate, authController.logout.bind(authController));

module.exports = router;

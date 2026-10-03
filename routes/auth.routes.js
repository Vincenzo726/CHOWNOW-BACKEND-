const express = require("express");

const {
    registerUser,
    verifyEmailOTP,
    loginUser,
    verifyLoginOTP,
    forgotPassword,
    resetPassword
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", registerUser);

router.post("/verify-email", verifyEmailOTP);

router.post("/login", loginUser);

router.post("/verify-login", verifyLoginOTP);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);

module.exports = router;
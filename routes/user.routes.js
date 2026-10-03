const express = require("express");

const protect = require("../middleware/auth");
const upload = require("../middleware/upload");

const {
    getUserProfile,
    updateUserProfile,
    getUniversityVendors,
    getUniversityFoods,
    getFoodById,
    uploadUserProfileImage
} = require("../controllers/user.controller");

const router = express.Router();

router.get("/profile", protect, getUserProfile);
router.patch("/profile", protect, updateUserProfile);
router.patch("/profile/image", protect, upload.single("profileImage"), uploadUserProfileImage);

router.get("/vendors", protect, getUniversityVendors);

router.get("/foods", protect, getUniversityFoods);

router.get("/foods/:id", protect, getFoodById);
module.exports = router;

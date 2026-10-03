const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Food = require("../models/Food");
const { uploadImageBuffer, imageUploadErrorMessage } = require("../services/image-upload.service");
const { z } = require("zod");

const updateUserProfile = async (req, res) => {
    try {
        const { phone } = z.object({ phone: z.string().min(7).optional() }).parse(req.body);
        const user = await User.findByIdAndUpdate(req.user.userId, { $set: { phone } }, { new: true, runValidators: true }).select("-password").populate("universityId", "name code");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.status(200).json({ success: true, message: "Account updated", user });
    } catch (error) {
        if (error.name === "ZodError") return res.status(400).json({ success: false, message: "Invalid input", errors: error.issues });
        console.error("Update user profile error:", error.message);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

const uploadUserProfileImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "Profile image is required" });
        const uploaded = await uploadImageBuffer(req.file.buffer, "chownow_profiles");
        const user = await User.findByIdAndUpdate(req.user.userId, { $set: { profileImage: uploaded.secure_url } }, { new: true }).select("-password").populate("universityId", "name code");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.status(200).json({ success: true, message: "Profile photo updated", user });
    } catch (error) {
        console.error("Upload user profile image error:", error.message);
        res.status(502).json({ success: false, message: imageUploadErrorMessage(error, "profile photo") });
    }
};

const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("-password")
            .populate("universityId", "name code");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            user
        });

    } catch (error) {
        console.error("Get user profile error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


const getUniversityVendors = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("universityId");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.universityId) {
            return res.status(400).json({
                success: false,
                message: "University not selected"
            });
        }

        const vendors = await Vendor.find({
            universityId: user.universityId,
            isActive: true
        }).select(
            "businessName ownerName phone businessAddress description logo rating totalRatings isOpen universityId"
        ).populate("universityId", "name code location");

        res.status(200).json({
            success: true,
            vendors
        });

    } catch (error) {
        console.error(
            "Get university vendors error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


const getUniversityFoods = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("universityId");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.universityId) {
            return res.status(400).json({
                success: false,
                message: "University not selected"
            });
        }

        const foods = await Food.find({
            universityId: user.universityId,
            isAvailable: true
        })
            .populate(
                "vendorId",
                "businessName logo rating totalRatings isOpen"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            foods
        });

    } catch (error) {
        console.error(
            "Get university foods error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const getFoodById = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("universityId");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.universityId) {
            return res.status(400).json({
                success: false,
                message: "University not selected"
            });
        }

        const food = await Food.findOne({
            _id: req.params.id,
            universityId: user.universityId
        })
            .populate(
                "vendorId",
                "businessName logo rating totalRatings isOpen businessAddress description"
            );

        if (!food) {
            return res.status(404).json({
                success: false,
                message: "Food not found"
            });
        }

        res.status(200).json({
            success: true,
            food
        });

    } catch (error) {
        console.error(
            "Get food by ID error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


module.exports = {
    getUserProfile,
    updateUserProfile,
    getUniversityVendors,
    getUniversityFoods,
    getFoodById,
    uploadUserProfileImage
};

const { z } = require("zod");

const User = require("../models/User");
const Vendor = require("../models/Vendor");
const University = require("../models/University");
const Food = require("../models/Food");
const { uploadImageBuffer, imageUploadErrorMessage } = require("../services/image-upload.service");
const { createAccount } = require("./auth.controller");
const upload = require("../middleware/upload");
const Order = require("../models/order");


// =========================
// GET PUBLIC VENDORS BY UNIVERSITY
// =========================

const getPublicVendorsByUniversity = async (req, res) => {
    try {
        const { universityId } = req.params;

        const vendors = await Vendor.find({
            universityId,
            isActive: true,
            isVerified: true
        })
            .select(
                "_id businessName businessAddress location description logo rating totalRatings isOpen isVerified universityId"
            )
            .populate("universityId", "name code")
            .sort({ businessName: 1 });

        return res.status(200).json({
            success: true,
            vendors
        });

    } catch (error) {
        console.error(
            "Get public vendors by university error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

// =========================
// VENDOR REGISTRATION
// =========================

const registerVendorSchema = z.object({
    name: z.string().min(2, "Owner name must be at least 2 characters"),

    email: z.string().email("Please enter a valid email"),

    password: z.string().min(6, "Password must be at least 6 characters"),

    businessName: z.string().min(2, "Business name is required"),

    phone: z.string().min(7, "Please enter a valid phone number"),

    universityId: z.string().min(1, "University is required"),

    businessAddress: z.string().min(2, "Business address is required"),

    description: z.string().optional()
});

const registerVendor = async (req, res) => {
    try {
        const validatedData = registerVendorSchema.parse(req.body);

        const {
            name,
            email,
            password,
            businessName,
            phone,
            universityId,
            businessAddress,
            description
        } = validatedData;

        const university = await University.findOne({
            _id: universityId,
            isActive: true
        });

        if (!university) {
            return res.status(404).json({
                success: false,
                message: "University not found"
            });
        }

        const { user, devOtp } = await createAccount({
    name,
    email,
    password,
    universityId: university._id,
    role: "VENDOR"
});

        const vendor = await Vendor.create({
            ownerId: user._id,
            businessName,
            ownerName: name,
            email: user.email,
            phone,
            universityId: university._id,
            businessAddress,
            description
        });

        res.status(201).json({
            success: true,
            message: "Vendor registration successful. OTP sent to your email.",
            vendor: {
                id: vendor._id,
                businessName: vendor.businessName,
                ownerId: vendor.ownerId,
                universityId: vendor.universityId,
                isVerified: vendor.isVerified,
                isActive: vendor.isActive
            },
            ...(isDevOtpMode()
        ? { devOtp }
        : {})
        });

    } catch (error) {
        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Invalid input",
                errors: error.issues
            });
        }

        if (error.message === "Email already registered") {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        console.error("Vendor registration error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// GET VENDOR PROFILE
// =========================

const getVendorProfile = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        }).populate(
            "universityId",
            "name code location"
        );

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        res.status(200).json({
            success: true,
            vendor
        });

    } catch (error) {
        console.error(
            "Get vendor profile error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// UPDATE VENDOR PROFILE
// =========================

const updateVendorProfile = async (req, res) => {
    try {
        const updateSchema = z.object({
            businessName: z.string().min(2).optional(),

            phone: z.string().min(7).optional(),

            businessAddress: z.string().min(2).optional(),

            description: z.string().optional(),

            location: z.object({
                latitude: z.number().min(-90).max(90),
                longitude: z.number().min(-180).max(180)
            }).optional(),

            isOpen: z.boolean().optional()
        });

        const data = updateSchema.parse(req.body);

        const vendor = await Vendor.findOneAndUpdate(
            {
                ownerId: req.user.userId
            },
            {
                $set: data
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Vendor profile updated successfully",
            vendor
        });

    } catch (error) {
        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Invalid input",
                errors: error.issues
            });
        }

        console.error(
            "Update vendor profile error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// CREATE FOOD
// =========================
  
const createFood = async (req, res) => {
    try {
        const foodSchema = z.object({
            name: z.string().min(2, "Food name is required"),

            category: z.enum([
                "DISH",
                "MEAT",
                "SNACK",
                "DRINK"
            ]),

            description: z.string().optional(),

            price: z.coerce
                .number()
                .min(0, "Price cannot be negative"),

            isAvailable: z
                .string()
                .optional()
                .transform((value) => {
                    if (value === undefined) return true;
                    return value === "true";
                })
        });

        const data = foodSchema.parse(req.body);

        console.log("Uploaded file:", req.file);

        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        let imageUrl;

        if (req.file) {
            const uploadResult = await uploadImageBuffer(req.file.buffer, "chownow_foods");

            imageUrl = uploadResult.secure_url;
        }

        const food = await Food.create({
            vendorId: vendor._id,
            universityId: vendor.universityId,
            name: data.name,
            category: data.category,
            description: data.description,
            price: data.price,
            image: imageUrl,
            isAvailable: data.isAvailable
        });

        res.status(201).json({
            success: true,
            message: "Food listed successfully",
            food
        });

    } catch (error) {
        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Invalid input",
                errors: error.issues
            });
        }

        console.error(
            "Create food error:",
            error.message
        );

        res.status(req.file ? 502 : 500).json({
            success: false,
            message: req.file ? imageUploadErrorMessage(error, "food image") : "Something went wrong"
        });
    }
};
// =========================
// GET VENDOR FOODS
// =========================

const getVendorFoods = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        const foods = await Food.find({
            vendorId: vendor._id
        }).sort({
            createdAt: -1
        });

        res.status(200).json({
            success: true,
            foods
        });

    } catch (error) {
        console.error(
            "Get vendor foods error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

// =========================
// UPDATE FOOD
// =========================

const updateFood = async (req, res) => {
    try {
        const updateSchema = z.object({
            name: z.string().min(2).optional(),
            category: z.enum([
                "DISH",
                "MEAT",
                "SNACK",
                "DRINK"
            ]).optional(),
            description: z.string().optional(),
            price: z.number().min(0).optional(),
            image: z.string().optional(),
            isAvailable: z.boolean().optional()
        });

        const data = updateSchema.parse(req.body);

        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        const food = await Food.findOneAndUpdate(
            {
                _id: req.params.id,
                vendorId: vendor._id
            },
            {
                $set: data
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!food) {
            return res.status(404).json({
                success: false,
                message: "Food not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Food updated successfully",
            food
        });

    } catch (error) {
        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Invalid input",
                errors: error.issues
            });
        }

        console.error("Update food error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// DELETE FOOD
// =========================

const deleteFood = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        const food = await Food.findOneAndDelete({
            _id: req.params.id,
            vendorId: vendor._id
        });

        if (!food) {
            return res.status(404).json({
                success: false,
                message: "Food not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Food deleted successfully"
        });

    } catch (error) {
        console.error("Delete food error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};
const getVendorOrders = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        const orders = await Order.find({
            vendorId: vendor._id
        })
            .populate(
                "userId",
                "name email"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders
        });

    } catch (error) {
        console.error("Get vendor orders error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const getVendorDashboard = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ ownerId: req.user.userId }).select("_id");
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor profile not found" });
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" })
            .formatToParts(new Date()).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
        const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+01:00`);
        const end = new Date(start.getTime() + 86400000);
        const [totals = {}] = await Order.aggregate([
            { $match: { vendorId: vendor._id } },
            { $group: {
                _id: null,
                totalEarned: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$total", 0] } },
                incoming: { $sum: { $cond: [{ $in: ["$status", ["CONFIRMED", "PREPARING", "READY", "ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"]] }, "$total", 0] } },
                todayEarned: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "COMPLETED"] }, { $gte: [{ $ifNull: ["$completedAt", "$updatedAt"] }, start] }, { $lt: [{ $ifNull: ["$completedAt", "$updatedAt"] }, end] }] }, "$total", 0] } },
                completedOrders: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } }
            } }
        ]);
        res.status(200).json({ success: true, dashboard: { totalEarned: totals.totalEarned || 0, incoming: totals.incoming || 0, todayEarned: totals.todayEarned || 0, completedOrders: totals.completedOrders || 0, earningsSource: "completed order total" } });
    } catch (error) {
        console.error("Get vendor dashboard error:", error.message);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

const uploadVendorLogo = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "Business image is required" });
        const vendor = await Vendor.findOne({ ownerId: req.user.userId });
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor profile not found" });
        const uploaded = await uploadImageBuffer(req.file.buffer, "chownow_vendors");
        vendor.logo = uploaded.secure_url;
        await vendor.save();
        res.status(200).json({ success: true, message: "Business image updated", vendor });
    } catch (error) {
        console.error("Upload vendor logo error:", error.message);
        res.status(502).json({ success: false, message: imageUploadErrorMessage(error, "business image") });
    }
};

const getVendorOrderById = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        const order = await Order.findOne({
            _id: req.params.id,
            vendorId: vendor._id
        })
            .populate(
                "userId",
                "name email"
            );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        console.error(
            "Get vendor order by ID error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const acceptOrder = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        const order = await Order.findOne({
            _id: req.params.id,
            vendorId: vendor._id
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: "Only pending orders can be accepted"
            });
        }

        order.status = "CONFIRMED";

        await order.save();

        res.status(200).json({
            success: true,
            message: "Order accepted successfully",
            order
        });

    } catch (error) {
        console.error("Accept order error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const startPreparingOrder = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        const order = await Order.findOne({
            _id: req.params.id,
            vendorId: vendor._id
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.status !== "CONFIRMED") {
            return res.status(400).json({
                success: false,
                message: "Only confirmed orders can be moved to preparing"
            });
        }

        order.status = "PREPARING";

        await order.save();

        res.status(200).json({
            success: true,
            message: "Order is now being prepared",
            order
        });

    } catch (error) {
        console.error(
            "Start preparing order error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const markOrderReady = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        const order = await Order.findOne({
            _id: req.params.id,
            vendorId: vendor._id
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.status !== "PREPARING") {
            return res.status(400).json({
                success: false,
                message: "Only preparing orders can be marked as ready"
            });
        }

        // Generate a random 5-digit pickup code
        const pickupCode = Math.floor(
            10000 + Math.random() * 90000
        ).toString();

        order.status = "READY";
        order.pickupCode = pickupCode;
        order.pickupCodeUsed = false;

        // Safety expiry: 24 hours
        order.pickupCodeExpiresAt = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

        await order.save();

        res.status(200).json({
            success: true,
            message: "Order is ready",
            order: {
                _id: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                pickupCode: pickupCode
            }
        });

    } catch (error) {
        console.error(
            "Mark order ready error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const verifyPickupCode = async (req, res) => {
    try {
        const { pickupCode } = req.body;

        if (!pickupCode) {
            return res.status(400).json({
                success: false,
                message: "Pickup code is required"
            });
        }

        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        const order = await Order.findOne({
            _id: req.params.id,
            vendorId: vendor._id
        }).select(
            "+pickupCode +pickupCodeExpiresAt"
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.fulfillmentType !== "PICKUP") {
            return res.status(400).json({
                success: false,
                message: "This order is not a pickup order"
            });
        }

        if (order.status !== "READY") {
            return res.status(400).json({
                success: false,
                message: "Order is not ready for pickup"
            });
        }

        if (order.pickupCodeUsed) {
            return res.status(400).json({
                success: false,
                message: "Pickup code has already been used"
            });
        }

        if (
            !order.pickupCodeExpiresAt ||
            new Date() > order.pickupCodeExpiresAt
        ) {
            return res.status(400).json({
                success: false,
                message: "Pickup code has expired"
            });
        }

        if (String(pickupCode) !== String(order.pickupCode)) {
            return res.status(400).json({
                success: false,
                message: "Invalid pickup code"
            });
        }

        order.pickupCodeUsed = true;
        order.pickupCode = undefined;
        order.pickupCodeExpiresAt = undefined;
        order.status = "COMPLETED";
        order.completedAt = new Date();

        await order.save();

        res.status(200).json({
            success: true,
            message: "Pickup verified successfully. Order completed.",
            order
        });

    } catch (error) {
        console.error(
            "Verify pickup code error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const verifyRiderPickupCode = async (req, res) => {
    try {
        const { riderPickupCode } = req.body;

        if (!riderPickupCode) {
            return res.status(400).json({
                success: false,
                message: "Rider pickup code is required"
            });
        }

        const vendor = await Vendor.findOne({
            ownerId: req.user.userId
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor profile not found"
            });
        }

        const order = await Order.findOne({
            _id: req.params.id,
            vendorId: vendor._id
        }).select(
            "+riderPickupCode +riderPickupCodeExpiresAt"
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.fulfillmentType !== "DELIVERY") {
            return res.status(400).json({
                success: false,
                message: "This is not a delivery order"
            });
        }

        if (order.status !== "ASSIGNED") {
            return res.status(400).json({
                success: false,
                message: "Order is not waiting for rider pickup"
            });
        }

        if (order.riderPickupCodeUsed) {
            return res.status(400).json({
                success: false,
                message: "Rider pickup code has already been used"
            });
        }

        if (
            !order.riderPickupCodeExpiresAt ||
            new Date() > order.riderPickupCodeExpiresAt
        ) {
            return res.status(400).json({
                success: false,
                message: "Rider pickup code has expired"
            });
        }

        if (
            String(riderPickupCode) !==
            String(order.riderPickupCode)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid rider pickup code"
            });
        }

        order.riderPickupCodeUsed = true;
        order.riderPickupCode = undefined;
        order.riderPickupCodeExpiresAt = undefined;
        order.status = "PICKED_UP";

        await order.save();

        res.status(200).json({
            success: true,
            message: "Rider pickup verified successfully",
            order
        });

    } catch (error) {
        console.error(
            "Verify rider pickup code error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

// =========================
// EXPORTS
// =========================

module.exports = {
    registerVendor,
    getVendorProfile,
    updateVendorProfile,
    uploadVendorLogo,
    createFood,
    getVendorFoods,
    updateFood,
    deleteFood,
    getVendorOrders,
    getVendorDashboard,
    getVendorOrderById,
    acceptOrder,
    startPreparingOrder,
    markOrderReady,
    verifyPickupCode,
    verifyRiderPickupCode,
    getPublicVendorsByUniversity
};

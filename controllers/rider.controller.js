const { z } = require("zod");

const User = require("../models/User");
const Rider = require("../models/rider");
const University = require("../models/University");
const Order = require("../models/order");
const { uploadImageBuffer, imageUploadErrorMessage } = require("../services/image-upload.service");

const { createAccount } = require("./auth.controller");


// =========================
// RIDER REGISTRATION
// =========================

const registerRiderSchema = z.object({
    name: z.string().min(2, "Rider name must be at least 2 characters"),

    email: z.string().email("Please enter a valid email"),

    password: z.string().min(6, "Password must be at least 6 characters"),

    phone: z.string().min(7, "Please enter a valid phone number"),

    universityId: z.string().min(1, "University is required"),

    vehicleType: z.enum([
        "BIKE",
        "CAR",
        "BICYCLE",
        "WALK"
    ])
});


const registerRider = async (req, res) => {
    try {
        const validatedData = registerRiderSchema.parse(req.body);

        const {
            name,
            email,
            password,
            phone,
            universityId,
            vehicleType
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
    role: "RIDER"
});

        const rider = await Rider.create({
            ownerId: user._id,
            universityId: university._id,
            phone,
            vehicleType
        });

        res.status(201).json({
            success: true,
            message: "Rider registration successful. OTP sent to your email.",
            rider: {
                id: rider._id,
                ownerId: rider.ownerId,
                universityId: rider.universityId,
                phone: rider.phone,
                vehicleType: rider.vehicleType,
                isAvailable: rider.isAvailable,
                isVerified: rider.isVerified,
                isActive: rider.isActive
            },
            ...(process.env.DEV_OTP_MODE === "true"
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

        console.error(
            "Rider registration error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// GET RIDER PROFILE
// =========================

const getRiderProfile = async (req, res) => {
    try {
        const rider = await Rider.findOne({
            ownerId: req.user.userId
        })
            .populate(
                "ownerId",
                "name email role profileImage"
            )
            .populate(
                "universityId",
                "name code location"
            );

        if (!rider) {
            return res.status(404).json({
                success: false,
                message: "Rider profile not found"
            });
        }

        res.status(200).json({
            success: true,
            rider
        });

    } catch (error) {
        console.error(
            "Get rider profile error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// UPDATE RIDER PROFILE
// =========================

const updateRiderProfile = async (req, res) => {
    try {
        const updateSchema = z.object({
            phone: z.string().min(7).optional(),

            vehicleType: z.enum([
                "BIKE",
                "CAR",
                "BICYCLE",
                "WALK"
            ]).optional()
        });

        const data = updateSchema.parse(req.body);

        const rider = await Rider.findOneAndUpdate(
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

        if (!rider) {
            return res.status(404).json({
                success: false,
                message: "Rider profile not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Rider profile updated successfully",
            rider
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
            "Update rider profile error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// UPDATE RIDER AVAILABILITY
// =========================

const updateRiderAvailability = async (req, res) => {
    try {
        const schema = z.object({
            isAvailable: z.boolean()
        });

        const { isAvailable } = schema.parse(req.body);

        const rider = await Rider.findOne({
            ownerId: req.user.userId
        });

        if (!rider) {
            return res.status(404).json({
                success: false,
                message: "Rider profile not found"
            });
        }

        if (!rider.isActive) {
            return res.status(400).json({
                success: false,
                message: "Rider account is inactive"
            });
        }

        if (!rider.isVerified && isAvailable === true) {
            return res.status(403).json({
                success: false,
                message: "Rider account must be verified before going online"
            });
        }

        rider.isAvailable = isAvailable;

        await rider.save();

        res.status(200).json({
            success: true,
            message: isAvailable
                ? "Rider is now available"
                : "Rider is now unavailable",
            rider
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
            "Update rider availability error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// UPDATE RIDER LOCATION (ACTIVE DELIVERIES ONLY)
// =========================

const updateRiderLocation = async (req, res) => {
    try {
        const schema = z.object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            heading: z.number().min(0).max(360).optional(),
            accuracy: z.number().min(0).optional()
        });
        const location = schema.parse(req.body);
        const rider = await Rider.findOne({ ownerId: req.user.userId });

        if (!rider) {
            return res.status(404).json({ success: false, message: "Rider profile not found" });
        }
        if (!rider.isActive) {
            return res.status(403).json({ success: false, message: "Rider account is inactive" });
        }

        const activeOrder = await Order.findOne({
            riderId: rider._id,
            fulfillmentType: "DELIVERY",
            status: { $in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"] }
        }).select("_id status");

        if (!activeOrder) {
            return res.status(409).json({ success: false, message: "Location can only be shared during an active delivery" });
        }

        rider.currentLocation = { latitude: location.latitude, longitude: location.longitude };
        rider.locationUpdatedAt = new Date();
        rider.locationOrderId = activeOrder._id;
        rider.heading = location.heading;
        rider.accuracy = location.accuracy;
        await rider.save();

        return res.status(200).json({
            success: true,
            message: "Rider location updated",
            location: {
                latitude: rider.currentLocation.latitude,
                longitude: rider.currentLocation.longitude,
                heading: rider.heading ?? null,
                accuracy: rider.accuracy ?? null,
                locationUpdatedAt: rider.locationUpdatedAt,
                orderId: activeOrder._id,
                status: activeOrder.status
            }
        });
    } catch (error) {
        if (error.name === "ZodError") {
            return res.status(400).json({ success: false, message: "Invalid location", errors: error.issues });
        }
        console.error("Update rider location error:", error.message);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

const uploadRiderImages = async (req, res) => {
    try {
        const rider = await Rider.findOne({ ownerId: req.user.userId });
        if (!rider) return res.status(404).json({ success: false, message: "Rider profile not found" });
        const fields = ["profileImage", "vehicleImage"];
        for (const field of fields) {
            const file = req.files?.[field]?.[0];
            if (!file) continue;
            const uploaded = await uploadImageBuffer(file.buffer, "chownow_riders");
            rider[field] = uploaded.secure_url;
        }
        if (!req.files?.profileImage?.length && !req.files?.vehicleImage?.length) return res.status(400).json({ success: false, message: "Select a rider photo or vehicle photo" });
        await rider.save();
        res.status(200).json({ success: true, message: "Rider images updated", rider });
    } catch (error) {
        console.error("Upload rider images error:", error.message);
        res.status(502).json({ success: false, message: imageUploadErrorMessage(error, "rider image") });
    }
};


// =========================
// GET AVAILABLE DELIVERY ORDERS
// =========================

const getAvailableDeliveryOrders = async (req, res) => {
    try {
        const rider = await Rider.findOne({
            ownerId: req.user.userId
        });

        if (!rider) {
            return res.status(404).json({
                success: false,
                message: "Rider profile not found"
            });
        }

        if (!rider.isActive) {
            return res.status(400).json({
                success: false,
                message: "Rider account is inactive"
            });
        }

        if (!rider.isVerified) {
            return res.status(403).json({
                success: false,
                message: "Rider account is not verified"
            });
        }

        if (!rider.isAvailable) {
            return res.status(400).json({
                success: false,
                message: "Rider is currently unavailable"
            });
        }

        const orders = await Order.find({
            fulfillmentType: "DELIVERY",
            universityId: rider.universityId,
            status: "READY",
            $or: [
                { riderId: { $exists: false } },
                { riderId: null }
            ]
        })
            .populate(
                "vendorId",
                "businessName logo phone businessAddress location"
            )
            .sort({
                createdAt: 1
            });

        res.status(200).json({
            success: true,
            orders
        });

    } catch (error) {
        console.error(
            "Get available delivery orders error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// GET RIDER ORDERS
// =========================

const getRiderOrders = async (req, res) => {
    try {
        const rider = await Rider.findOne({
            ownerId: req.user.userId
        });

        if (!rider) {
            return res.status(404).json({
                success: false,
                message: "Rider profile not found"
            });
        }

        const orders = await Order.find({
            riderId: rider._id
        })
            .populate(
                "vendorId",
                "businessName logo phone businessAddress location"
            )
            .populate("userId", "name email phone profileImage")
            .sort({
                createdAt: -1
            });

        res.status(200).json({
            success: true,
            orders
        });

    } catch (error) {
        console.error(
            "Get rider orders error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// GET RIDER ORDER BY ID
// =========================

const getRiderDashboard = async (req, res) => {
    try {
        const rider = await Rider.findOne({ ownerId: req.user.userId }).select("_id");
        if (!rider) return res.status(404).json({ success: false, message: "Rider profile not found" });
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" })
            .formatToParts(new Date()).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
        const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+01:00`);
        const end = new Date(start.getTime() + 86400000);
        const [totals = {}] = await Order.aggregate([
            { $match: { riderId: rider._id, fulfillmentType: "DELIVERY" } },
            { $group: {
                _id: null,
                totalEarned: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$deliveryFee", 0] } },
                incoming: { $sum: { $cond: [{ $in: ["$status", ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"]] }, "$deliveryFee", 0] } },
                todayEarned: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "COMPLETED"] }, { $gte: [{ $ifNull: ["$completedAt", "$updatedAt"] }, start] }, { $lt: [{ $ifNull: ["$completedAt", "$updatedAt"] }, end] }] }, "$deliveryFee", 0] } },
                completedOrders: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
                deliveryOrders: { $sum: 1 },
                configuredFeeOrders: { $sum: { $cond: [{ $gt: ["$deliveryFee", 0] }, 1, 0] } }
            } }
        ]);
        res.status(200).json({ success: true, dashboard: {
            totalEarned: totals.totalEarned || 0, incoming: totals.incoming || 0,
            todayEarned: totals.todayEarned || 0, completedOrders: totals.completedOrders || 0,
            earningsSource: "deliveryFee", hasConfiguredFee: (totals.configuredFeeOrders || 0) > 0,
            deliveryOrders: totals.deliveryOrders || 0
        } });
    } catch (error) {
        console.error("Get rider dashboard error:", error.message);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

const getRiderOrderById = async (req, res) => {
    try {
        const rider = await Rider.findOne({
            ownerId: req.user.userId
        });

        if (!rider) {
            return res.status(404).json({
                success: false,
                message: "Rider profile not found"
            });
        }

        const order = await Order.findOne({
            _id: req.params.id,
            riderId: rider._id
        })
            .populate(
                "vendorId",
                "businessName logo phone businessAddress location"
            )
            .populate(
                "userId",
                "name email phone profileImage"
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
            "Get rider order error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// ACCEPT DELIVERY ORDER
// =========================

const acceptDeliveryOrder = async (req, res) => {
    try {
        const rider = await Rider.findOne({
            ownerId: req.user.userId
        });

        if (!rider) {
            return res.status(404).json({
                success: false,
                message: "Rider profile not found"
            });
        }

        if (!rider.isActive) {
            return res.status(400).json({
                success: false,
                message: "Rider account is inactive"
            });
        }

        if (!rider.isVerified) {
            return res.status(403).json({
                success: false,
                message: "Rider account is not verified"
            });
        }

        if (!rider.isAvailable) {
            return res.status(400).json({
                success: false,
                message: "Rider is currently unavailable"
            });
        }

        const riderPickupCode = Math.floor(
            10000 + Math.random() * 90000
        ).toString();

        const riderPickupCodeExpiresAt = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                fulfillmentType: "DELIVERY",
                universityId: rider.universityId,
                status: "READY",
                $or: [
                    { riderId: { $exists: false } },
                    { riderId: null }
                ]
            },
            {
                $set: {
                    riderId: rider._id,
                    riderPickupCode,
                    riderPickupCodeExpiresAt,
                    riderPickupCodeUsed: false,
                    deliveryCodeUsed: false,
                    status: "ASSIGNED"
                }
            },
            {
                new: true
            }
        );

        if (!order) {
            return res.status(409).json({
                success: false,
                message: "This delivery order is no longer available"
            });
        }

        res.status(200).json({
            success: true,
            message: "Delivery order accepted successfully",
            order: {
                _id: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                fulfillmentType: order.fulfillmentType,
                riderId: order.riderId,
                riderPickupCode
            }
        });

    } catch (error) {
        console.error(
            "Accept delivery order error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// MARK OUT FOR DELIVERY
// =========================

const markOutForDelivery = async (req, res) => {
    try {
        const rider = await Rider.findOne({
            ownerId: req.user.userId
        });

        if (!rider) {
            return res.status(404).json({
                success: false,
                message: "Rider profile not found"
            });
        }

        const order = await Order.findOne({
            _id: req.params.id,
            riderId: rider._id
        });

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

        if (order.status !== "PICKED_UP") {
            return res.status(400).json({
                success: false,
                message: "Order must be picked up before going out for delivery"
            });
        }

        const deliveryCode = Math.floor(
            10000 + Math.random() * 90000
        ).toString();

        const deliveryCodeExpiresAt = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

        order.status = "OUT_FOR_DELIVERY";
        order.deliveryCode = deliveryCode;
        order.deliveryCodeExpiresAt = deliveryCodeExpiresAt;
        order.deliveryCodeUsed = false;

        await order.save();

        res.status(200).json({
            success: true,
            message: "Order is now out for delivery",
            order: {
                _id: order._id,
                orderNumber: order.orderNumber,
                status: order.status
            }
        });

    } catch (error) {
        console.error(
            "Mark out for delivery error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// =========================
// VERIFY DELIVERY CODE
// =========================

const verifyDeliveryCode = async (req, res) => {
    try {
        const { deliveryCode } = req.body;

        if (!deliveryCode) {
            return res.status(400).json({
                success: false,
                message: "Delivery code is required"
            });
        }

        const rider = await Rider.findOne({
            ownerId: req.user.userId
        });

        if (!rider) {
            return res.status(404).json({
                success: false,
                message: "Rider profile not found"
            });
        }

        const order = await Order.findOne({
            _id: req.params.id,
            riderId: rider._id
        }).select(
            "+deliveryCode +deliveryCodeExpiresAt"
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

        if (order.status !== "OUT_FOR_DELIVERY") {
            return res.status(400).json({
                success: false,
                message: "Order is not out for delivery"
            });
        }

        if (order.deliveryCodeUsed) {
            return res.status(400).json({
                success: false,
                message: "Delivery code has already been used"
            });
        }

        if (
            !order.deliveryCodeExpiresAt ||
            new Date() > order.deliveryCodeExpiresAt
        ) {
            return res.status(400).json({
                success: false,
                message: "Delivery code has expired"
            });
        }

        if (
            String(deliveryCode) !==
            String(order.deliveryCode)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid delivery code"
            });
        }

        order.deliveryCodeUsed = true;
        order.deliveryCode = undefined;
        order.deliveryCodeExpiresAt = undefined;
        order.status = "COMPLETED";
        order.completedAt = new Date();

        await order.save();

        res.status(200).json({
            success: true,
            message: "Delivery verified successfully. Order completed.",
            order
        });

    } catch (error) {
        console.error(
            "Verify delivery code error:",
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
    registerRider,
    getRiderProfile,
    uploadRiderImages,
    updateRiderProfile,
    updateRiderAvailability,
    updateRiderLocation,
    getAvailableDeliveryOrders,
    getRiderOrders,
    getRiderDashboard,
    getRiderOrderById,
    acceptDeliveryOrder,
    markOutForDelivery,
    verifyDeliveryCode
};

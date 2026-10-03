const User = require("../models/User");
const Cart = require("../models/cart");
const Order = require("../models/order");
const Vendor = require("../models/Vendor");

const createOrder = async (req, res) => {
    try {
        const {
            fulfillmentType,
            deliveryAddress
        } = req.body;

        if (!["PICKUP", "DELIVERY"].includes(fulfillmentType)) {
            return res.status(400).json({
                success: false,
                message: "Fulfillment type must be PICKUP or DELIVERY"
            });
        }

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

        // DELIVERY orders must have a destination
        if (fulfillmentType === "DELIVERY") {
            if (
                !deliveryAddress ||
                typeof deliveryAddress !== "object"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Delivery address is required for delivery orders"
                });
            }

            const {
                address,
                latitude,
                longitude
            } = deliveryAddress;

            if (!address) {
                return res.status(400).json({
                    success: false,
                    message: "Delivery address is required"
                });
            }

            if (
                latitude === undefined ||
                longitude === undefined
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Delivery location coordinates are required"
                });
            }

            if (
                typeof latitude !== "number" ||
                typeof longitude !== "number"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Latitude and longitude must be numbers"
                });
            }

            if (
                latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid delivery coordinates"
                });
            }
        }

        const cart = await Cart.findOne({
            userId: req.user.userId
        }).populate(
            "items.foodId",
            "name price isAvailable"
        );

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Your cart is empty"
            });
        }

        if (
            cart.universityId.toString() !==
            user.universityId.toString()
        ) {
            return res.status(400).json({
                success: false,
                message: "Cart does not belong to your selected university"
            });
        }

        // Check vendor before creating the order
        const vendor = await Vendor.findById(
            cart.vendorId
        ).select(
            "isActive isOpen"
        );

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found"
            });
        }

        if (!vendor.isActive) {
            return res.status(400).json({
                success: false,
                message: "Vendor is currently unavailable"
            });
        }

        if (!vendor.isOpen) {
            return res.status(400).json({
                success: false,
                message: "Vendor is currently closed"
            });
        }

        const items = cart.items.map((item) => {
            const subtotal =
                item.foodId.price * item.quantity;

            return {
                foodId: item.foodId._id,
                name: item.foodId.name,
                price: item.foodId.price,
                quantity: item.quantity,
                subtotal
            };
        });

        const subtotal = items.reduce(
            (total, item) => total + item.subtotal,
            0
        );

        const deliveryFee =
            fulfillmentType === "DELIVERY"
                ? 0
                : 0;

        const total = subtotal + deliveryFee;

        const orderNumber =
            `CHN-${Date.now()}-${Math.floor(
                1000 + Math.random() * 9000
            )}`;

        const orderData = {
            orderNumber,
            userId: req.user.userId,
            vendorId: cart.vendorId,
            universityId: cart.universityId,
            items,
            fulfillmentType,

            // Vendor is open and accepting orders,
            // so the server confirms automatically.
            status: "CONFIRMED",

            subtotal,
            deliveryFee,
            total
        };

        if (fulfillmentType === "DELIVERY") {
            orderData.deliveryAddress = {
                address: deliveryAddress.address,
                latitude: deliveryAddress.latitude,
                longitude: deliveryAddress.longitude,
                instructions:
                    deliveryAddress.instructions || ""
            };
        }

        const order = await Order.create(
            orderData
        );

        await Cart.findByIdAndDelete(
            cart._id
        );

        res.status(201).json({
            success: true,
            message: "Order created successfully",
            order
        });

    } catch (error) {
        console.error(
            "Create order error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            userId: req.user.userId
        })
            .populate("vendorId", "businessName logo rating totalRatings isOpen businessAddress phone location description universityId")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders
        });

    } catch (error) {
        console.error("Get my orders error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            userId: req.user.userId
        })
            .populate(
                "vendorId",
                "businessName logo rating totalRatings isOpen phone businessAddress"
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
        console.error("Get order by ID error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};
const getOrderTracking = async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            userId: req.user.userId,
            fulfillmentType: "DELIVERY"
        })
            .populate("vendorId", "businessName businessAddress location")
            .populate({
                path: "userId",
                select: "name phone"
            })
            .populate({
                path: "riderId",
                select: "ownerId vehicleType +locationOrderId +currentLocation +locationUpdatedAt +heading +accuracy",
                populate: { path: "ownerId", select: "name profileImage" }
            });

        if (!order) {
            return res.status(404).json({ success: false, message: "Delivery order not found" });
        }

        const trackingActive = ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(order.status);
        const assignedRider = order.riderId;
        const hasLocation = trackingActive && assignedRider?.currentLocation &&
            String(assignedRider.locationOrderId) === String(order._id) &&
            !!assignedRider.locationUpdatedAt &&
            Number.isFinite(assignedRider.currentLocation.latitude) &&
            Number.isFinite(assignedRider.currentLocation.longitude);

        return res.status(200).json({
            success: true,
            tracking: {
                order: {
                    _id: order._id,
                    orderNumber: order.orderNumber,
                    status: order.status,
                    fulfillmentType: order.fulfillmentType,
                    deliveryAddress: order.deliveryAddress,
                    updatedAt: order.updatedAt
                },
                vendor: order.vendorId ? {
                    businessName: order.vendorId.businessName,
                    businessAddress: order.vendorId.businessAddress,
                    location: order.vendorId.location || null
                } : null,
                rider: assignedRider ? {
                    name: assignedRider.ownerId?.name || null,
                    vehicleType: assignedRider.vehicleType,
                    currentLocation: hasLocation ? {
                        latitude: assignedRider.currentLocation.latitude,
                        longitude: assignedRider.currentLocation.longitude
                    } : null,
                    heading: hasLocation ? assignedRider.heading ?? null : null,
                    accuracy: hasLocation ? assignedRider.accuracy ?? null : null,
                    locationUpdatedAt: hasLocation ? assignedRider.locationUpdatedAt ?? null : null,
                    trackingActive
                } : null
            }
        });
    } catch (error) {
        console.error("Get order tracking error:", error.message);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};


const getMyPickupCode = async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            userId: req.user.userId
        }).select(
            "orderNumber status fulfillmentType pickupCode pickupCodeExpiresAt pickupCodeUsed"
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
                message: "Pickup code is not available yet"
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

        res.status(200).json({
            success: true,
            orderNumber: order.orderNumber,
            status: order.status,
            pickupCode: order.pickupCode,
            expiresAt: order.pickupCodeExpiresAt
        });

    } catch (error) {
        console.error(
            "Get pickup code error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};
const getMyDeliveryCode = async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            userId: req.user.userId
        }).select(
            "orderNumber status fulfillmentType deliveryCode deliveryCodeExpiresAt deliveryCodeUsed"
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
                message: "Delivery code is not available yet"
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

        res.status(200).json({
            success: true,
            orderNumber: order.orderNumber,
            status: order.status,
            deliveryCode: order.deliveryCode,
            expiresAt: order.deliveryCodeExpiresAt
        });

    } catch (error) {
        console.error(
            "Get delivery code error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};
module.exports = {
    createOrder,
    getMyOrders,
    getOrderById,
    getOrderTracking,
    getMyPickupCode,
    getMyDeliveryCode
};

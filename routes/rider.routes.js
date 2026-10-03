const express = require("express");

const protect = require("../middleware/auth");
const upload = require("../middleware/upload");

const {
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
} = require("../controllers/rider.controller");

const router = express.Router();


// Rider registration
router.post(
    "/register",
    registerRider
);


// Rider profile
router.get(
    "/profile",
    protect,
    getRiderProfile
);

router.patch(
    "/profile",
    protect,
    updateRiderProfile
);

router.patch(
    "/availability",
    protect,
    updateRiderAvailability
);

router.patch("/profile/images", protect, upload.fields([{ name: "profileImage", maxCount: 1 }, { name: "vehicleImage", maxCount: 1 }]), uploadRiderImages);

router.patch(
    "/location",
    protect,
    updateRiderLocation
);


// Rider orders
router.get(
    "/orders/available",
    protect,
    getAvailableDeliveryOrders
);

router.get("/dashboard", protect, getRiderDashboard);

router.get(
    "/orders",
    protect,
    getRiderOrders
);

router.get(
    "/orders/:id",
    protect,
    getRiderOrderById
);

router.patch(
    "/orders/:id/accept",
    protect,
    acceptDeliveryOrder
);

router.patch(
    "/orders/:id/out-for-delivery",
    protect,
    markOutForDelivery
);

router.patch(
    "/orders/:id/verify-delivery",
    protect,
    verifyDeliveryCode
);

module.exports = router;

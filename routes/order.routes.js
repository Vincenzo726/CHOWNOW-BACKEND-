const express = require("express");

const protect = require("../middleware/auth");

const {
    createOrder,
    getMyOrders,
    getOrderById,
    getOrderTracking,
    getMyPickupCode,
    getMyDeliveryCode
} = require("../controllers/order.controller");

const router = express.Router();

router.post(
    "/",
    protect,
    createOrder
);
router.get(
    "/",
    protect,
    getMyOrders
);
router.get(
    "/:id/tracking",
    protect,
    getOrderTracking
);
router.get(
    "/:id",
    protect,
    getOrderById
);
router.get(
    "/:id/pickup-code",
    protect,
    getMyPickupCode
);
router.get(
    "/:id/delivery-code",
    protect,
    getMyDeliveryCode
);
module.exports = router;

const express = require("express");

const protect = require("../middleware/auth");
const upload = require("../middleware/upload");

const {
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
} = require("../controllers/vendor.controller");

const router = express.Router();

router.post("/register", registerVendor);

router.get("/profile", protect, getVendorProfile);

router.patch("/profile", protect, updateVendorProfile);
router.patch("/profile/image", protect, upload.single("image"), uploadVendorLogo);

router.post(
    "/foods",
    protect,
    upload.single("image"),
    createFood
);

router.get("/foods", protect, getVendorFoods);

router.patch("/foods/:id", protect, updateFood);

router.delete("/foods/:id", protect, deleteFood);

router.get("/dashboard", protect, getVendorDashboard);

router.get(
    "/orders",
    protect,
    getVendorOrders
);

router.get(
    "/orders/:id",
    protect,
    getVendorOrderById
);

router.patch(
    "/orders/:id/accept",
    protect,
    acceptOrder
);
router.patch(
    "/orders/:id/prepare",
    protect,
    startPreparingOrder
);
router.patch(
    "/orders/:id/ready",
    protect,
    markOrderReady
);
router.patch(
    "/orders/:id/verify-pickup",
    protect,
    verifyPickupCode
);
router.patch(
    "/orders/:id/verify-rider-pickup",
    protect,
    verifyRiderPickupCode
);
router.get(
    "/by-university/:universityId",
    getPublicVendorsByUniversity
);
module.exports = router;

const express = require("express");

const protect = require("../middleware/auth");

const {
    addToCart,
    getCart,
    updateCartItem,
    removeCartItem,
    clearCart
} = require("../controllers/cart.controller");

const router = express.Router();

router.post("/add", protect, addToCart);
router.get("/", protect, getCart);
router.patch("/items/:foodId", protect, updateCartItem);
router.delete(
    "/items/:foodId",
    protect,
    removeCartItem
);
router.delete(
    "/clear",
    protect,
    clearCart
);
module.exports = router;
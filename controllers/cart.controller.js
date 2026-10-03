const User = require("../models/User");
const Food = require("../models/Food");
const Cart = require("../models/cart");

const addToCart = async (req, res) => {
    try {
        const { foodId, quantity } = req.body;

        if (!foodId) {
            return res.status(400).json({
                success: false,
                message: "Food ID is required"
            });
        }

        const qty = Number(quantity) || 1;

        if (qty < 1) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be at least 1"
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

        const food = await Food.findOne({
            _id: foodId,
            universityId: user.universityId,
            isAvailable: true
        });

        if (!food) {
            return res.status(404).json({
                success: false,
                message: "Food not found or unavailable"
            });
        }

        let cart = await Cart.findOne({
            userId: req.user.userId
        });

        // Create a new cart
        if (!cart) {
            cart = await Cart.create({
                userId: req.user.userId,
                universityId: user.universityId,
                vendorId: food.vendorId,
                items: [
                    {
                        foodId: food._id,
                        quantity: qty
                    }
                ]
            });

            await cart.populate([
                {
                    path: "vendorId",
                    select: "businessName logo rating totalRatings isOpen"
                },
                {
                    path: "items.foodId",
                    select: "name category description price image isAvailable"
                }
            ]);

            return res.status(201).json({
                success: true,
                message: "Food added to cart",
                cart
            });
        }

        // Prevent multiple vendors in one cart
        if (cart.vendorId.toString() !== food.vendorId.toString()) {
            return res.status(409).json({
                success: false,
                message: "Your cart contains food from another vendor. Clear your cart before adding this food."
            });
        }

        // Check if food already exists in cart
        const existingItem = cart.items.find(
            (item) => item.foodId.toString() === food._id.toString()
        );

        if (existingItem) {
            existingItem.quantity += qty;
        } else {
            cart.items.push({
                foodId: food._id,
                quantity: qty
            });
        }

        await cart.save();

        await cart.populate([
            {
                path: "vendorId",
                select: "businessName logo rating totalRatings isOpen"
            },
            {
                path: "items.foodId",
                select: "name category description price image isAvailable"
            }
        ]);

        res.status(200).json({
            success: true,
            message: "Food added to cart",
            cart
        });

    } catch (error) {
        console.error("Add to cart error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const getCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({
            userId: req.user.userId
        })
            .populate(
                "vendorId",
                "businessName logo rating totalRatings isOpen"
            )
            .populate(
                "items.foodId",
                "name category description price image isAvailable"
            );

        if (!cart) {
            return res.status(200).json({
                success: true,
                message: "Cart is empty",
                cart: {
                    items: [],
                    subtotal: 0,
                    deliveryFee: 0,
                    total: 0
                }
            });
        }

        let subtotal = 0;

        const items = cart.items.map((item) => {
            const itemSubtotal = item.foodId.price * item.quantity;

            subtotal += itemSubtotal;

            return {
                food: item.foodId,
                quantity: item.quantity,
                subtotal: itemSubtotal
            };
        });

        const deliveryFee = 0;

        const total = subtotal + deliveryFee;

        res.status(200).json({
            success: true,
            cart: {
                _id: cart._id,
                vendor: cart.vendorId,
                items,
                subtotal,
                deliveryFee,
                total
            }
        });

    } catch (error) {
        console.error("Get cart error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const updateCartItem = async (req, res) => {
    try {
        const { foodId } = req.params;
        const { quantity } = req.body;

        const qty = Number(quantity);

        if (!Number.isInteger(qty) || qty < 1) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a whole number greater than 0"
            });
        }

        const cart = await Cart.findOne({
            userId: req.user.userId
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        const item = cart.items.find(
            (item) => item.foodId.toString() === foodId
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Food is not in your cart"
            });
        }

        const food = await Food.findOne({
            _id: foodId,
            universityId: cart.universityId,
            isAvailable: true
        });

        if (!food) {
            return res.status(404).json({
                success: false,
                message: "Food not found or unavailable"
            });
        }

        item.quantity = qty;

        await cart.save();

        await cart.populate([
            {
                path: "vendorId",
                select: "businessName logo rating totalRatings isOpen"
            },
            {
                path: "items.foodId",
                select: "name category description price image isAvailable"
            }
        ]);

        let subtotal = 0;

        const items = cart.items.map((cartItem) => {
            const itemSubtotal =
                cartItem.foodId.price * cartItem.quantity;

            subtotal += itemSubtotal;

            return {
                food: cartItem.foodId,
                quantity: cartItem.quantity,
                subtotal: itemSubtotal
            };
        });

        const deliveryFee = 0;
        const total = subtotal + deliveryFee;

        res.status(200).json({
            success: true,
            message: "Cart updated successfully",
            cart: {
                _id: cart._id,
                vendor: cart.vendorId,
                items,
                subtotal,
                deliveryFee,
                total
            }
        });

    } catch (error) {
        console.error("Update cart item error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const removeCartItem = async (req, res) => {
    try {
        const { foodId } = req.params;

        const cart = await Cart.findOne({
            userId: req.user.userId
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        const itemIndex = cart.items.findIndex(
            (item) => item.foodId.toString() === foodId
        );

        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Food is not in your cart"
            });
        }

        cart.items.splice(itemIndex, 1);

        // If no items remain, delete the cart completely
        if (cart.items.length === 0) {
            await Cart.findByIdAndDelete(cart._id);

            return res.status(200).json({
                success: true,
                message: "Item removed and cart is now empty",
                cart: {
                    items: [],
                    subtotal: 0,
                    deliveryFee: 0,
                    total: 0
                }
            });
        }

        await cart.save();

        await cart.populate([
            {
                path: "vendorId",
                select: "businessName logo rating totalRatings isOpen"
            },
            {
                path: "items.foodId",
                select: "name category description price image isAvailable"
            }
        ]);

        let subtotal = 0;

        const items = cart.items.map((cartItem) => {
            const itemSubtotal =
                cartItem.foodId.price * cartItem.quantity;

            subtotal += itemSubtotal;

            return {
                food: cartItem.foodId,
                quantity: cartItem.quantity,
                subtotal: itemSubtotal
            };
        });

        const deliveryFee = 0;
        const total = subtotal + deliveryFee;

        res.status(200).json({
            success: true,
            message: "Item removed from cart",
            cart: {
                _id: cart._id,
                vendor: cart.vendorId,
                items,
                subtotal,
                deliveryFee,
                total
            }
        });

    } catch (error) {
        console.error("Remove cart item error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({
            userId: req.user.userId
        });

        if (!cart) {
            return res.status(200).json({
                success: true,
                message: "Cart is already empty"
            });
        }

        await Cart.findByIdAndDelete(cart._id);

        res.status(200).json({
            success: true,
            message: "Cart cleared successfully"
        });

    } catch (error) {
        console.error("Clear cart error:", error.message);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

module.exports = {
    addToCart,
    getCart,
    updateCartItem,
    removeCartItem,
    clearCart
};
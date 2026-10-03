const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
    {
        foodId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Food",
            required: true
        },

        name: {
            type: String,
            required: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        _id: false
    }
);

const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            unique: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vendor",
            required: true
        },

        universityId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "University",
            required: true
        },

        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: (items) => items.length > 0,
                message: "Order must contain at least one item"
            }
        },

        fulfillmentType: {
            type: String,
            enum: ["PICKUP", "DELIVERY"],
            required: true
        },
                  deliveryAddress: {
    address: {
        type: String,
        trim: true
    },

    latitude: {
        type: Number,
        min: -90,
        max: 90
    },

    longitude: {
        type: Number,
        min: -180,
        max: 180
    },

    instructions: {
        type: String,
        trim: true
    }
},
        status: {
            type: String,
            enum: [
                "PENDING",
                "CONFIRMED",
                "PREPARING",
                "READY",
                "ASSIGNED",
                "PICKED_UP",
                "OUT_FOR_DELIVERY",
                "COMPLETED",
                "CANCELLED"
            ],
            default: "PENDING"
        },

        completedAt: { type: Date },

        subtotal: {
            type: Number,
            required: true,
            min: 0
        },

        deliveryFee: {
            type: Number,
            default: 0,
            min: 0
        },

        total: {
            type: Number,
            required: true,
            min: 0
        },
        pickupCode: {
    type: String,
    select: false
},

pickupCodeExpiresAt: {
    type: Date,
    select: false
},

pickupCodeUsed: {
    type: Boolean,
    default: false
},
 riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Rider"
},

riderPickupCode: {
    type: String,
    select: false
},

riderPickupCodeExpiresAt: {
    type: Date,
    select: false
},

riderPickupCodeUsed: {
    type: Boolean,
    default: false
},

deliveryCode: {
    type: String,
    select: false
},

deliveryCodeExpiresAt: {
    type: Date,
    select: false
},

deliveryCodeUsed: {
    type: Boolean,
    default: false
},
    },
    {
        timestamps: true
    }
);

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;

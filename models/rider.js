const mongoose = require("mongoose");

const riderSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        universityId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "University",
            required: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        vehicleType: {
            type: String,
            enum: ["BIKE", "CAR", "BICYCLE", "WALK"],
            required: true
        },

        profileImage: { type: String },
        vehicleImage: { type: String },

        currentLocation: {
            type: new mongoose.Schema({
                latitude: { type: Number, min: -90, max: 90, required: true },
                longitude: { type: Number, min: -180, max: 180, required: true }
            }, { _id: false }),
            default: undefined,
            select: false
        },

        locationUpdatedAt: {
            type: Date,
            select: false
        },

        locationOrderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            select: false
        },

        heading: {
            type: Number,
            min: 0,
            max: 360,
            select: false
        },

        accuracy: {
            type: Number,
            min: 0,
            select: false
        },

        isAvailable: {
            type: Boolean,
            default: false
        },

        isVerified: {
            type: Boolean,
            default: false
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

const Rider = mongoose.model("Rider", riderSchema);

module.exports = Rider;

const mongoose = require("mongoose");
const validator = require("validator");

const vendorSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        businessName: {
            type: String,
            required: true,
            trim: true
        },

        ownerName: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            validate: {
                validator: (value) => validator.isEmail(value),
                message: "Please enter a valid email address"
            }
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        universityId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "University",
            required: true
        },

        businessAddress: {
            type: String,
            required: true,
            trim: true
        },

        location: {
            type: new mongoose.Schema({
                latitude: { type: Number, min: -90, max: 90, required: true },
                longitude: { type: Number, min: -180, max: 180, required: true }
            }, { _id: false }),
            default: undefined
        },

        description: {
            type: String,
            trim: true
        },

        logo: {
            type: String
        },
          rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
},

totalRatings: {
    type: Number,
    default: 0
},

isOpen: {
    type: Boolean,
    default: true
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

const Vendor = mongoose.model("Vendor", vendorSchema);

module.exports = Vendor;

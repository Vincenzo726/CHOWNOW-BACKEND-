const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },

        otp: {
            type: String,
            required: true
        },

        purpose: {
            type: String,
            enum: ["EMAIL_VERIFICATION", "LOGIN", "PASSWORD_RESET"],
            required: true
        },

        expiresAt: {
            type: Date,
            required: true
        },

        used: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

const OTP = mongoose.model("OTP", otpSchema);

module.exports = OTP;
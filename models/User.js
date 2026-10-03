const mongoose = require("mongoose");
const validator = require("validator");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            validate: {
                validator: (value) => validator.isEmail(value),
                message: "Please enter a valid email address"
            }
        },

        password: {
            type: String,
            required: true
        },
        profileImage: { type: String },
        phone: { type: String, trim: true },
         role: {
            type: String,
             enum: ["CUSTOMER", "VENDOR", "RIDER", "ADMIN", "SUPER_ADMIN"],
            default: "CUSTOMER"
        },

        universityId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "University"
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

const User = mongoose.model("User", userSchema);

module.exports = User;

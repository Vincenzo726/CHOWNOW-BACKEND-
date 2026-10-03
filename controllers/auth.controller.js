const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { z } = require("zod");

const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Rider = require("../models/rider");
const OTP = require("../models/OTP");
const sendEmail = require("../services/email.service");

/*
|--------------------------------------------------------------------------
| DEVELOPMENT OTP MODE
|--------------------------------------------------------------------------
| DEV_OTP_MODE=true
| - No email is sent.
| - OTP is returned in the API response.
| - OTP is also printed in the backend terminal.
|
| DEV_OTP_MODE=false / absent
| - Real email sending is used.
|--------------------------------------------------------------------------
*/

const isDevOtpMode = () => {
    return process.env.DEV_OTP_MODE === "true";
};

const sendOtpEmail = async ({
    to,
    subject,
    html,
    otp
}) => {
    // Development: do not touch Mailtrap at all.
    if (isDevOtpMode()) {
        console.warn(`[DEV OTP] ${to} -> ${otp}`);
        return;
    }

    // Production / real-email mode
    await sendEmail({
        to,
        subject,
        html
    });
};

const generateOtp = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

const createOtp = async ({
    userId,
    email,
    purpose
}) => {
    // Disable previous unused OTPs of the same purpose
    await OTP.updateMany(
        {
            userId,
            purpose,
            used: false
        },
        {
            used: true
        }
    );

    const otp = generateOtp();

    await OTP.create({
        userId,
        email,
        otp,
        purpose,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    return otp;
};

const getValidOtp = async ({
    email,
    otp,
    purpose
}) => {
    return OTP.findOne({
        email: email.toLowerCase().trim(),
        otp,
        purpose,
        used: false,
        expiresAt: {
            $gt: new Date()
        }
    }).sort({
        createdAt: -1
    });
};

/*
|--------------------------------------------------------------------------
| CREATE ACCOUNT
|--------------------------------------------------------------------------
| Central account creator.
| Used by CUSTOMER, VENDOR and RIDER registration.
|--------------------------------------------------------------------------
*/

const createAccount = async ({
    name,
    email,
    password,
    universityId,
    role = "CUSTOMER"
}) => {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
        email: normalizedEmail
    });

    if (existingUser) {
        throw new Error("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        universityId,
        role
    });

    const otp = await createOtp({
        userId: user._id,
        email: user.email,
        purpose: "EMAIL_VERIFICATION"
    });

    await sendOtpEmail({
        to: user.email,
        subject: "CHOWNOW Account Verification",
        otp,
        html: `
            <div style="font-family:Arial,sans-serif;">
                <h2>Welcome to CHOWNOW</h2>

                <p>
                    Use the verification code below to verify your account:
                </p>

                <h1>${otp}</h1>

                <p>This code expires in 5 minutes.</p>

                <p>
                    If you did not create this account, please ignore this email.
                </p>
            </div>
        `
    });

    return {
        user,
        devOtp: isDevOtpMode() ? otp : undefined
    };
};

/*
|--------------------------------------------------------------------------
| CUSTOMER REGISTRATION
|--------------------------------------------------------------------------
*/

const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    universityId: z.string().min(1, "University is required")
});

const registerUser = async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);

        const {
            user,
            devOtp
        } = await createAccount({
            ...data,
            role: "CUSTOMER"
        });

        return res.status(201).json({
            success: true,
            message: "Registration successful. OTP sent to your email.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                universityId: user.universityId,
                role: user.role,
                isVerified: user.isVerified
            },
            ...(isDevOtpMode() ? { devOtp } : {})
        });
    } catch (error) {
        console.error("Registration error:", error.message);

        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.errors
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || "Registration failed"
        });
    }
};

/*
|--------------------------------------------------------------------------
| VERIFY EMAIL OTP
|--------------------------------------------------------------------------
*/

const verifyEmailOtpSchema = z.object({
    email: z.string().email("Please enter a valid email"),
    otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
});

const verifyEmailOTP = async (req, res) => {
    try {
        const {
            email,
            otp
        } = verifyEmailOtpSchema.parse(req.body);

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: "Email already verified"
            });
        }

        const otpRecord = await getValidOtp({
            email: normalizedEmail,
            otp,
            purpose: "EMAIL_VERIFICATION"
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP"
            });
        }

        otpRecord.used = true;
        await otpRecord.save();

        user.isVerified = true;
        await user.save();

        // Keep role-specific profiles synced
        if (user.role === "VENDOR") {
            await Vendor.findOneAndUpdate(
                {
                    ownerId: user._id
                },
                {
                    isVerified: true
                }
            );
        }

        if (user.role === "RIDER") {
            await Rider.findOneAndUpdate(
                {
                    ownerId: user._id
                },
                {
                    isVerified: true
                }
            );
        }

        return res.status(200).json({
            success: true,
            message: "Email verified successfully"
        });
    } catch (error) {
        console.error("Email verification error:", error.message);

        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.errors
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || "Email verification failed"
        });
    }
};

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

const loginSchema = z.object({
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(1, "Password is required")
});

const loginUser = async (req, res) => {
    try {
        const {
            email,
            password
        } = loginSchema.parse(req.body);

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated"
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: "Please verify your email before logging in"
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const otp = await createOtp({
            userId: user._id,
            email: user.email,
            purpose: "LOGIN"
        });

        await sendOtpEmail({
            to: user.email,
            subject: "CHOWNOW Login OTP",
            otp,
            html: `
                <div style="font-family:Arial,sans-serif;">
                    <h2>CHOWNOW Login Verification</h2>

                    <p>
                        Use the verification code below to complete your login:
                    </p>

                    <h1>${otp}</h1>

                    <p>This code expires in 5 minutes.</p>
                </div>
            `
        });

        return res.status(200).json({
            success: true,
            message: "Login OTP sent to your email",
            ...(isDevOtpMode() ? { devOtp: otp } : {})
        });
    } catch (error) {
        console.error("Login error:", error.message);

        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.errors
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || "Login failed"
        });
    }
};

/*
|--------------------------------------------------------------------------
| VERIFY LOGIN OTP
|--------------------------------------------------------------------------
*/

const verifyLoginOtpSchema = z.object({
    email: z.string().email("Please enter a valid email"),
    otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
});

const verifyLoginOTP = async (req, res) => {
    try {
        const {
            email,
            otp
        } = verifyLoginOtpSchema.parse(req.body);

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated"
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: "Please verify your email first"
            });
        }

        const otpRecord = await getValidOtp({
            email: normalizedEmail,
            otp,
            purpose: "LOGIN"
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP"
            });
        }

        otpRecord.used = true;
        await otpRecord.save();

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            expiresIn: "1h",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                universityId: user.universityId,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Verify login OTP error:", error.message);

        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.errors
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || "OTP verification failed"
        });
    }
};

/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD
|--------------------------------------------------------------------------
*/

const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email")
});

const forgotPassword = async (req, res) => {
    try {
        const {
            email
        } = forgotPasswordSchema.parse(req.body);

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({
            email: normalizedEmail
        });

        // Keep response generic
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If an account exists with this email, a password reset OTP has been sent."
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated"
            });
        }

        const otp = await createOtp({
            userId: user._id,
            email: user.email,
            purpose: "PASSWORD_RESET"
        });

        await sendOtpEmail({
            to: user.email,
            subject: "CHOWNOW Password Reset OTP",
            otp,
            html: `
                <div style="font-family:Arial,sans-serif;">
                    <h2>CHOWNOW Password Reset</h2>

                    <p>
                        Use the verification code below to reset your password:
                    </p>

                    <h1>${otp}</h1>

                    <p>This code expires in 5 minutes.</p>

                    <p>
                        If you did not request a password reset, please ignore this email.
                    </p>
                </div>
            `
        });

        return res.status(200).json({
            success: true,
            message: "Password reset OTP sent to your email",
            ...(isDevOtpMode() ? { devOtp: otp } : {})
        });
    } catch (error) {
        console.error("Forgot password error:", error.message);

        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.errors
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || "Forgot password request failed"
        });
    }
};

/*
|--------------------------------------------------------------------------
| RESET PASSWORD
|--------------------------------------------------------------------------
*/

const resetPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email"),
    otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
    newPassword: z.string().min(6, "Password must be at least 6 characters")
});

const resetPassword = async (req, res) => {
    try {
        const {
            email,
            otp,
            newPassword
        } = resetPasswordSchema.parse(req.body);

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const otpRecord = await getValidOtp({
            email: normalizedEmail,
            otp,
            purpose: "PASSWORD_RESET"
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP"
            });
        }

        const hashedPassword = await bcrypt.hash(
            newPassword,
            10
        );

        user.password = hashedPassword;
        await user.save();

        otpRecord.used = true;
        await otpRecord.save();

        return res.status(200).json({
            success: true,
            message: "Password reset successful. You can now log in."
        });
    } catch (error) {
        console.error("Reset password error:", error.message);

        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.errors
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || "Password reset failed"
        });
    }
};

module.exports = {
    createAccount,
    registerUser,
    verifyEmailOTP,
    loginUser,
    verifyLoginOTP,
    forgotPassword,
    resetPassword
};
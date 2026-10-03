const cloudinary = require("cloudinary").v2;
const config = { secure: true };

if (process.env.CLOUDINARY_CLOUD_NAME) config.cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
if (process.env.CLOUDINARY_API_KEY) config.api_key = process.env.CLOUDINARY_API_KEY;
if (process.env.CLOUDINARY_API_SECRET) config.api_secret = process.env.CLOUDINARY_API_SECRET;

cloudinary.config(config);

module.exports = cloudinary;

const cloudinary = require("../config/cloudinary");

const uploadImageBuffer = (buffer, folder) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return Promise.reject(new Error("The selected image is empty"));
    }

    const { cloud_name, api_key, api_secret } = cloudinary.config();
    if (!cloud_name || !api_key || !api_secret) {
        return Promise.reject(new Error(
            "Image uploads are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the backend."
        ));
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "image" },
            (error, result) => {
                if (error) return reject(error);
                if (!result?.secure_url || !result?.public_id) {
                    return reject(new Error("Cloudinary did not return an image URL"));
                }
                resolve(result);
            }
        );
        stream.on("error", reject);
        stream.end(buffer);
    });
};

const imageUploadErrorMessage = (error, label) => {
    const message = String(error?.message || "");
    if (Number(error?.http_code) === 403) {
        return `Cloudinary denied the ${label} upload (HTTP 403). Check that the configured Cloudinary account is active and that its API key is allowed to upload images.`;
    }
    if (/invalid signature|invalid api key|unknown api key|authentication/i.test(message)) {
        return `Cloudinary rejected the upload credentials. Check the backend Cloudinary API key and secret.`;
    }
    if (/timeout|ENOTFOUND|ECONN|socket|network/i.test(message)) {
        return `Could not connect to Cloudinary while uploading the ${label}. Check the server connection and retry.`;
    }
    return `Unable to upload ${label}: ${message || "Cloudinary returned an unknown error"}`;
};

module.exports = { uploadImageBuffer, imageUploadErrorMessage };

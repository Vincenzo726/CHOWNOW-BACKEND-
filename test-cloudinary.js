require("dotenv").config();

const cloudinary = require("./config/cloudinary");

async function testCloudinary() {
    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.unsigned_upload_stream(
                "chownow_foods",
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            ).end(
                require("fs").readFileSync(
                    "NIGERIAN JOLLOF RICE.jfif"
                )
            );
        });

        console.log("CLOUDINARY UNSIGNED TEST SUCCESS:");
        console.log(result.secure_url);

    } catch (error) {
        console.error("CLOUDINARY UNSIGNED TEST ERROR:");
        console.error(error);
    }
}

testCloudinary();
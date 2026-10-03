const University = require("../models/University");

const getUniversities = async (req, res) => {
    try {
        const universities = await University.find({
            isActive: true
        })
            .select("_id name code location")
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            universities
        });

    } catch (error) {
        console.error(
            "Get universities error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

module.exports = {
    getUniversities
};
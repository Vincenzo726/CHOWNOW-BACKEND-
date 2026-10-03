const { BimpeAI } = require("@bimpeai/sdk");

const bimpe = new BimpeAI({
    apiKey: process.env.BIMPEAI_API_KEY
});

module.exports = bimpe;
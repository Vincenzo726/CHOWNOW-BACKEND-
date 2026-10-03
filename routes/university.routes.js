const express = require("express");

const {
    getUniversities
} = require("../controllers/university.controller");

const router = express.Router();

router.get(
    "/",
    getUniversities
);

module.exports = router;
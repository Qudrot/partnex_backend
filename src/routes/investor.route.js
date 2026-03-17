const express = require("express");
const router = express.Router();

const investorController = require("../controllers/investor.controller");
const authenticate = require("../middleware/auth");
const authorize = require("../middleware/authorize");

// Existing route for fetching the SME feed
router.get("/smes", authenticate, authorize("investor"), investorController.listSmes);

// NEW routes for investor profile creation and fetching
router.post("/profile", authenticate, authorize("investor"), investorController.createProfile);
router.get("/me", authenticate, authorize("investor"), investorController.getMyProfile);

module.exports = router;
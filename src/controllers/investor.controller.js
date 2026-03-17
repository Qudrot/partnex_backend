const investorService = require("../services/investor.service");

const saveProfile = async (req, res) => {
  try {
    const result = await investorService.saveProfile(req.user.id, req.body);
    // Send 201 for a new profile, 200 for an update
    return res.status(result.isNew ? 201 : 200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const result = await investorService.getMyProfile(req.user.id);
    return res.json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

const listSmes = async (req, res) => {
  try {
    const result = await investorService.listSmesWithScores(req.query);
    return res.json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

module.exports = { saveProfile, getMyProfile, listSmes };
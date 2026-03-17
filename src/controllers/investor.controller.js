const investorService = require("../services/investor.service");

const createProfile = async (req, res) => {
  try {
    const result = await investorService.createProfile(req.user.id, req.body);
    return res.status(201).json(result);
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

module.exports = { createProfile, getMyProfile, listSmes };
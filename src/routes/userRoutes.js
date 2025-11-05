const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Get complete user profile
router.get('/:username', userController.getUserProfile);

// Get basic user info only
router.get('/:username/info', userController.getUserInfo);

// Get solved problems with pagination
router.get('/:username/solved', userController.getSolvedProblems);

module.exports = router;

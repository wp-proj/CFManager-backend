const { Router } = require('express');
const { compareProfiles } = require('../controllers/CompareProfiles');
const userController = require('../controllers/Usercontroller');
const router = Router();
router.post('/compare', compareProfiles);
router.get('/user/:username', userController.getUserProfile);
router.get('/user/:username/info', userController.getUserInfo);
router.get('/user/:username/solved', userController.getSolvedProblems);

module.exports = router;
module.exports = router;

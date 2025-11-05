const { Router } = require('express');
const { compareProfiles } = require('../controllers/userController');

const router = Router();
router.post('/compare', compareProfiles);

module.exports = router;

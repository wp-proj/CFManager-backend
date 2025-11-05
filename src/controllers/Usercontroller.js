const codeforcesService = require('../services/codeforcesService');

class UserController {
  async getUserProfile(req, res, next) {
    try {
      const { username } = req.params;

      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Username is required'
        });
      }

      console.log(`🔍 Fetching profile for: ${username}`);
      
      const profile = await codeforcesService.getUserProfile(username);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  // Get only basic user info (lighter endpoint)
  async getUserInfo(req, res, next) {
    try {
      const { username } = req.params;

      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Username is required'
        });
      }

      const userInfo = await codeforcesService.getUserInfo(username);

      res.json({
        success: true,
        data: userInfo
      });
    } catch (error) {
      next(error);
    }
  }

  // Get solved problems only
  async getSolvedProblems(req, res, next) {
    try {
      const { username } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      const submissions = await codeforcesService.getUserStatus(username);
      const { solvedProblems } = codeforcesService.processSolvedProblems(submissions);

      const paginatedProblems = solvedProblems.slice(
        parseInt(offset),
        parseInt(offset) + parseInt(limit)
      );

      res.json({
        success: true,
        data: {
          total: solvedProblems.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          problems: paginatedProblems
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();

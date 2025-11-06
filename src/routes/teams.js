
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const axios = require('axios');
const NodeCache = require('node-cache');

// Cache for 5 minutes
const cache = new NodeCache({ stdTTL: 300 });

// Helper function to fetch user data from Codeforces
async function fetchUserData(username) {
  const cacheKey = `user_${username}`;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    // Fetch user info
    const userInfoResponse = await axios.get(
      `https://codeforces.com/api/user.info?handles=${username}`
    );
    
    if (userInfoResponse.data.status !== 'OK') {
      throw new Error('User not found');
    }

    const userInfo = userInfoResponse.data.result[0];

    // Fetch user submissions
    const userStatusResponse = await axios.get(
      `https://codeforces.com/api/user.status?handle=${username}`
    );

    let solvedCount = 0;
    const solvedProblems = new Set();

    if (userStatusResponse.data.status === 'OK') {
      userStatusResponse.data.result.forEach(submission => {
        if (submission.verdict === 'OK') {
          const problemId = `${submission.problem.contestId}-${submission.problem.index}`;
          solvedProblems.add(problemId);
        }
      });
      solvedCount = solvedProblems.size;
    }

    const userData = {
      username: userInfo.handle,
      rating: userInfo.rating || 0,
      maxRating: userInfo.maxRating || 0,
      rank: userInfo.rank || 'Unrated',
      maxRank: userInfo.maxRank || 'Unrated',
      country: userInfo.country || 'Unknown',
      organization: userInfo.organization || 'Unknown',
      solvedCount: solvedCount,
      avatar: userInfo.titlePhoto || userInfo.avatar || '',
      contribution: userInfo.contribution || 0
    };

    cache.set(cacheKey, userData);
    return userData;
  } catch (error) {
    console.error(`Error fetching user ${username}:`, error.message);
    throw error;
  }
}

// POST /api/teams - Create a new team
router.post('/', async (req, res) => {
  try {
    const { name, members, createdBy } = req.body;

    // Validation
    if (!name || !members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Team name and members array are required'
      });
    }

    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: 'createdBy field is required'
      });
    }

    // Verify all members exist on Codeforces
    const invalidMembers = [];
    for (const member of members) {
      try {
        await fetchUserData(member);
      } catch (error) {
        invalidMembers.push(member);
      }
      // Rate limiting: sleep for 0.5 seconds between API calls
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (invalidMembers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some usernames are invalid',
        invalidMembers
      });
    }

    const team = new Team({
      name,
      members,
      createdBy
    });

    await team.save();

    res.status(201).json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating team',
      error: error.message
    });
  }
});

// GET /api/teams/:id - Get team by ID
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching team',
      error: error.message
    });
  }
});

// GET /api/teams/:id/leaderboard - Get team leaderboard
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const leaderboardData = [];

    // Fetch data for all team members
    for (const member of team.members) {
      try {
        const userData = await fetchUserData(member);
        leaderboardData.push(userData);
        
        // Rate limiting: sleep for 0.5 seconds between API calls
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching data for ${member}:`, error.message);
        // Add user with default values if fetch fails
        leaderboardData.push({
          username: member,
          rating: 0,
          maxRating: 0,
          rank: 'Unknown',
          maxRank: 'Unknown',
          country: 'Unknown',
          organization: 'Unknown',
          solvedCount: 0,
          avatar: '',
          contribution: 0,
          error: 'Failed to fetch data'
        });
      }
    }

    // Sort by rating (descending), then by solved count
    leaderboardData.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.solvedCount - a.solvedCount;
    });

    // Add rank position
    leaderboardData.forEach((user, index) => {
      user.position = index + 1;
    });

    res.json({
      success: true,
      data: {
        teamId: team._id,
        teamName: team.name,
        memberCount: team.members.length,
        leaderboard: leaderboardData
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leaderboard',
      error: error.message
    });
  }
});

// GET /api/teams - Get all teams (optional, for listing)
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching teams',
      error: error.message
    });
  }
});

// DELETE /api/teams/:id - Delete a team (optional)
router.delete('/:id', async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting team',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching team',
      error: error.message
    });
  }
});
module.exports = router;

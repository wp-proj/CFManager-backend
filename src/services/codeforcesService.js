const axios = require('axios');
const cache = require('../config/cache');

const CF_API_BASE = 'https://codeforces.com/api';

// Rate limiting: Codeforces allows 1 call per 2 seconds
let lastCallTime = 0;
const MIN_CALL_INTERVAL = 2000;

const rateLimitedRequest = async (url) => {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  
  if (timeSinceLastCall < MIN_CALL_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_CALL_INTERVAL - timeSinceLastCall));
  }
  
  lastCallTime = Date.now();
  return axios.get(url);
};

class CodeforcesService {
  // Fetch user basic info
  async getUserInfo(username) {
    const cacheKey = `userInfo_${username}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ Cache hit: ${cacheKey}`);
      return cached;
    }

    try {
      const response = await rateLimitedRequest(`${CF_API_BASE}/user.info?handles=${username}`);
      
      if (response.data.status !== 'OK') {
        throw new Error('User not found');
      }

      const userInfo = response.data.result[0];
      cache.set(cacheKey, userInfo);
      console.log(`📦 Cached: ${cacheKey}`);
      
      return userInfo;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        throw new Error('User not found');
      }
      throw error;
    }
  }

  // Fetch user submissions
  async getUserStatus(username) {
    const cacheKey = `userStatus_${username}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ Cache hit: ${cacheKey}`);
      return cached;
    }

    try {
      const response = await rateLimitedRequest(`${CF_API_BASE}/user.status?handle=${username}`);
      
      if (response.data.status !== 'OK') {
        throw new Error('Failed to fetch submissions');
      }

      const submissions = response.data.result;
      cache.set(cacheKey, submissions);
      console.log(`📦 Cached: ${cacheKey}`);
      
      return submissions;
    } catch (error) {
      throw error;
    }
  }

  // Fetch user rating history
  async getUserRating(username) {
    const cacheKey = `userRating_${username}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ Cache hit: ${cacheKey}`);
      return cached;
    }

    try {
      const response = await rateLimitedRequest(`${CF_API_BASE}/user.rating?handle=${username}`);
      
      if (response.data.status !== 'OK') {
        return []; // User might not have rating history
      }

      const ratingHistory = response.data.result;
      cache.set(cacheKey, ratingHistory);
      console.log(`📦 Cached: ${cacheKey}`);
      
      return ratingHistory;
    } catch (error) {
      return []; // Return empty array if no rating history
    }
  }

  // Process submissions to get solved problems
  processSolvedProblems(submissions) {
    const solvedProblems = new Map();
    const problemsByTag = {};
    const problemsByRating = {};

    submissions.forEach(submission => {
      if (submission.verdict === 'OK') {
        const problem = submission.problem;
        const problemKey = `${problem.contestId}-${problem.index}`;

        if (!solvedProblems.has(problemKey)) {
          solvedProblems.set(problemKey, {
            contestId: problem.contestId,
            index: problem.index,
            name: problem.name,
            rating: problem.rating || 'N/A',
            tags: problem.tags || [],
            solvedAt: submission.creationTimeSeconds
          });

          // Count by tags
          problem.tags.forEach(tag => {
            problemsByTag[tag] = (problemsByTag[tag] || 0) + 1;
          });

          // Count by rating
          if (problem.rating) {
            const ratingBucket = Math.floor(problem.rating / 100) * 100;
            problemsByRating[ratingBucket] = (problemsByRating[ratingBucket] || 0) + 1;
          }
        }
      }
    });

    return {
      solvedProblems: Array.from(solvedProblems.values()),
      problemsByTag,
      problemsByRating
    };
  }

  // Generate heatmap data
  generateHeatmapData(submissions) {
    const heatmapData = {};

    submissions.forEach(submission => {
      if (submission.verdict === 'OK') {
        const date = new Date(submission.creationTimeSeconds * 1000);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        heatmapData[dateStr] = (heatmapData[dateStr] || 0) + 1;
      }
    });

    // Convert to array format for frontend
    return Object.entries(heatmapData).map(([date, count]) => ({
      date,
      count
    }));
  }

  // Calculate submission statistics
  calculateSubmissionStats(submissions) {
    const stats = {
      total: submissions.length,
      accepted: 0,
      wrongAnswer: 0,
      timeLimitExceeded: 0,
      runtimeError: 0,
      compilationError: 0,
      other: 0
    };

    const verdictMap = {
      'OK': 'accepted',
      'WRONG_ANSWER': 'wrongAnswer',
      'TIME_LIMIT_EXCEEDED': 'timeLimitExceeded',
      'RUNTIME_ERROR': 'runtimeError',
      'COMPILATION_ERROR': 'compilationError'
    };

    submissions.forEach(submission => {
      const statKey = verdictMap[submission.verdict] || 'other';
      stats[statKey]++;
    });

    return stats;
  }

  // Get complete user profile
  async getUserProfile(username) {
    try {
      // Fetch all data in parallel
      const [userInfo, submissions, ratingHistory] = await Promise.all([
        this.getUserInfo(username),
        this.getUserStatus(username),
        this.getUserRating(username)
      ]);

      // Process submissions
      const { solvedProblems, problemsByTag, problemsByRating } = this.processSolvedProblems(submissions);
      const heatmapData = this.generateHeatmapData(submissions);
      const submissionStats = this.calculateSubmissionStats(submissions);

      // Build complete profile
      return {
        username: userInfo.handle,
        rating: userInfo.rating || 0,
        maxRating: userInfo.maxRating || 0,
        rank: userInfo.rank || 'Unrated',
        maxRank: userInfo.maxRank || 'Unrated',
        country: userInfo.country || 'Unknown',
        organization: userInfo.organization || 'N/A',
        avatar: userInfo.avatar || userInfo.titlePhoto,
        friendOfCount: userInfo.friendOfCount || 0,
        contribution: userInfo.contribution || 0,
        registrationTimeSeconds: userInfo.registrationTimeSeconds,
        solvedCount: solvedProblems.length,
        submissionStats,
        problemsByTag,
        problemsByRating,
        ratingHistory: ratingHistory.map(contest => ({
          contestId: contest.contestId,
          contestName: contest.contestName,
          rank: contest.rank,
          ratingUpdateTimeSeconds: contest.ratingUpdateTimeSeconds,
          oldRating: contest.oldRating,
          newRating: contest.newRating
        })),
        heatmapData,
        solvedProblems: solvedProblems.slice(0, 100) // Limit to 100 most recent for initial load
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new CodeforcesService();

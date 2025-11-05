const cf = require('../services/codeforcesService');

// allowed: Latin letters, digits, underscore, dash
const HANDLE_RE = /^[A-Za-z0-9_-]+$/;
function sanitizeHandle(raw) {
  if (raw == null) return null;
  return String(raw).trim();
}
function isValidHandle(s) {
  return HANDLE_RE.test(s);
}

// helper to key problems consistently
function keyOfProblem(p) {
  // fallbacks in case some submissions don’t have contestId/rating
  const cid = p.contestId ?? 'GYM';
  const idx = p.index ?? '?';
  const name = p.name ?? '';
  return `${cid}-${idx}-${name}`;
}

async function compareProfiles(req, res, next) {
  try {
    let { user1, user2 } = req.body || {};
    user1 = sanitizeHandle(user1);
    user2 = sanitizeHandle(user2);

    if (!user1 || !user2) {
      const err = new Error('Both "user1" and "user2" must be provided in JSON body.');
      err.status = 400;
      throw err;
    }
    const bad = [];
    if (!isValidHandle(user1)) bad.push({ field: 'user1', value: user1 });
    if (!isValidHandle(user2)) bad.push({ field: 'user2', value: user2 });
    if (bad.length) {
      const err = new Error('Handles may contain only Latin letters, digits, underscore (_), or dash (-).');
      err.status = 400;
      err.details = bad;
      throw err;
    }

    // use your service to fetch both complete profiles in parallel
    const [p1, p2] = await Promise.all([
      cf.getUserProfile(user1),
      cf.getUserProfile(user2)
    ]);

    // sets for quick membership checks
    const set1 = new Set((p1.solvedProblems || []).map(keyOfProblem));
    const set2 = new Set((p2.solvedProblems || []).map(keyOfProblem));

    // common and unique problems
    const commonProblems = [];
    const user1Unique = [];
    const user2Unique = [];

    for (const prob of p1.solvedProblems || []) {
      (set2.has(keyOfProblem(prob)) ? commonProblems : user1Unique).push(prob);
    }
    for (const prob of p2.solvedProblems || []) {
      if (!set1.has(keyOfProblem(prob))) user2Unique.push(prob);
    }

    // tag distribution comparison (based on your problemsByTag objects)
    const tag1 = p1.problemsByTag || {};
    const tag2 = p2.problemsByTag || {};
    const allTags = Array.from(new Set([...Object.keys(tag1), ...Object.keys(tag2)]));
    const tagDistributionComparison = allTags
      .map(tag => ({ tag, user1: tag1[tag] || 0, user2: tag2[tag] || 0 }))
      .sort((a, b) => (b.user1 + b.user2) - (a.user1 + a.user2));

    // rating comparison
    const ratingComparison = {
      user1: p1.rating ?? 0,
      user2: p2.rating ?? 0,
      maxUser1: p1.maxRating ?? 0,
      maxUser2: p2.maxRating ?? 0
    };

    res.json({
      user1: {
        username: p1.username,
        rating: p1.rating,
        maxRating: p1.maxRating,
        rank: p1.rank,
        solvedCount: p1.solvedCount
      },
      user2: {
        username: p2.username,
        rating: p2.rating,
        maxRating: p2.maxRating,
        rank: p2.rank,
        solvedCount: p2.solvedCount
      },
      comparison: {
        commonProblems,
        user1Unique,
        user2Unique,
        tagDistributionComparison,
        ratingComparison
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { compareProfiles };

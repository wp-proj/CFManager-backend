const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  // User not found
  if (err.message === 'User not found') {
    return res.status(404).json({
      success: false,
      error: 'User not found on Codeforces'
    });
  }

  // Axios errors
  if (err.response) {
    return res.status(err.response.status || 500).json({
      success: false,
      error: err.response.data?.comment || 'External API error'
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
};

module.exports = errorHandler;

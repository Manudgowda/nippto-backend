/**
 * Global Error Handler Middleware
 * Must be the LAST middleware added to Express
 */
const errorHandler = (err, req, res, next) => {
  console.error('🔴 Unhandled error:', err.message);

  // Joi / express-validator errors
  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }

  // Default 500
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error.'
        : err.message,
  });
};

/**
 * 404 Not Found Handler
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
};

module.exports = { errorHandler, notFound };

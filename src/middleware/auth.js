const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();

  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Middleware to check if user is a driver
const isDriver = (req, res, next) => {
  if (req.user.type !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Drivers only.'
    });
  }
  next();
};

// Middleware to check if user is a rider
const isRider = (req, res, next) => {
  if (req.user.type !== 'user') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Riders only.'
    });
  }
  next();
};

module.exports = { authenticateToken, isDriver, isRider };
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateAccessToken = (user) => {
  // Extract just the ID string - teamId might be a populated object if user was fetched with .populate()
  const teamId = user.teamId?._id ? user.teamId._id.toString() : (user.teamId ? user.teamId.toString() : null);
  return jwt.sign(
    { id: user._id, role: user.role, teamId, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
};

const hashToken = async (token) => {
  return bcrypt.hash(token, 10);
};

const compareToken = async (plain, hashed) => {
  return bcrypt.compare(plain, hashed);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = { generateAccessToken, generateRefreshToken, hashToken, compareToken, verifyRefreshToken };
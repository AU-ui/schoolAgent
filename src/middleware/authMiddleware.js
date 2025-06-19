const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};

// Middleware to check if user is a teacher
const isTeacher = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Access denied. Teachers only.' });
    }
    next();
};

// Middleware to check if user is a parent
const isParent = (req, res, next) => {
    if (req.user.role !== 'parent') {
        return res.status(403).json({ message: 'Access denied. Parents only.' });
    }
    next();
};

// Middleware to check if user is a school admin
const isSchoolAdmin = (req, res, next) => {
    if (req.user.role !== 'schoolAdmin') {
        return res.status(403).json({ message: 'Access denied. School administrators only.' });
    }
    next();
};

// Middleware to check if user is a super admin
const isSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Access denied. Super administrators only.' });
    }
    next();
};

module.exports = {
    verifyToken,
    isTeacher,
    isParent,
    isSchoolAdmin,
    isSuperAdmin
}; 
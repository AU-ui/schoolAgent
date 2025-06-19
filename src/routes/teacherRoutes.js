const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const teacherController = require('../controllers/teacherController');
const { verifyToken } = require('../middleware/authMiddleware');

// Get all teachers
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM teachers');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new teacher
router.post('/', async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const result = await pool.query(
            'INSERT INTO teachers (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
            [name, email, phone]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a teacher
router.put('/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { name, email, phone } = req.body;
        const result = await pool.query(
            'UPDATE teachers SET name = $1, email = $2, phone = $3 WHERE id = $4 RETURNING *',
            [name, email, phone, teacherId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Teacher not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a teacher
router.delete('/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        const result = await pool.query('DELETE FROM teachers WHERE id = $1 RETURNING *', [teacherId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Teacher not found' });
        }
        res.json({ message: 'Teacher deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get teacher's classes
router.get('/classes', verifyToken, teacherController.getTeacherClasses);

// Get teacher's tasks
router.get('/tasks', verifyToken, teacherController.getTeacherTasks);

module.exports = router;
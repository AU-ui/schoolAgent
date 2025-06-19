const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all students
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM students');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new student
router.post('/', async (req, res) => {
    try {
        const { name, class_id } = req.body;
        const result = await pool.query(
            'INSERT INTO students (name, class_id) VALUES ($1, $2) RETURNING *',
            [name, class_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a student
router.put('/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { name, class_id } = req.body;
        const result = await pool.query(
            'UPDATE students SET name = $1, class_id = $2 WHERE id = $3 RETURNING *',
            [name, class_id, studentId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a student
router.delete('/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [studentId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
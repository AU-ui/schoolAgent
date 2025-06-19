const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all grades
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM grades');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new grade
router.post('/', async (req, res) => {
    try {
        const { student_id, subject_id, score } = req.body;
        const result = await pool.query(
            'INSERT INTO grades (student_id, subject_id, score) VALUES ($1, $2, $3) RETURNING *',
            [student_id, subject_id, score]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a grade
router.put('/:gradeId', async (req, res) => {
    try {
        const { gradeId } = req.params;
        const { score } = req.body;
        const result = await pool.query(
            'UPDATE grades SET score = $1 WHERE id = $2 RETURNING *',
            [score, gradeId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Grade not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a grade
router.delete('/:gradeId', async (req, res) => {
    try {
        const { gradeId } = req.params;
        const result = await pool.query('DELETE FROM grades WHERE id = $1 RETURNING *', [gradeId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Grade not found' });
        }
        res.json({ message: 'Grade deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
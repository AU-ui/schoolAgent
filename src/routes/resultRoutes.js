const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all results
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM results');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new result
router.post('/', async (req, res) => {
    try {
        const { student_id, exam_id, marks, grade, remarks } = req.body;
        const result = await pool.query(
            'INSERT INTO results (student_id, exam_id, marks, grade, remarks) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [student_id, exam_id, marks, grade, remarks]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a result
router.put('/:resultId', async (req, res) => {
    try {
        const { resultId } = req.params;
        const { marks, grade, remarks } = req.body;
        const result = await pool.query(
            'UPDATE results SET marks = $1, grade = $2, remarks = $3 WHERE id = $4 RETURNING *',
            [marks, grade, remarks, resultId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Result not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a result
router.delete('/:resultId', async (req, res) => {
    try {
        const { resultId } = req.params;
        const result = await pool.query('DELETE FROM results WHERE id = $1 RETURNING *', [resultId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Result not found' });
        }
        res.json({ message: 'Result deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
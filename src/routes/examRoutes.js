const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all exams
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM exams');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new exam
router.post('/', async (req, res) => {
    try {
        const { subject_id, date, start_time, end_time } = req.body;
        const result = await pool.query(
            'INSERT INTO exams (subject_id, date, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
            [subject_id, date, start_time, end_time]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update an exam
router.put('/:examId', async (req, res) => {
    try {
        const { examId } = req.params;
        const { date, start_time, end_time } = req.body;
        const result = await pool.query(
            'UPDATE exams SET date = $1, start_time = $2, end_time = $3 WHERE id = $4 RETURNING *',
            [date, start_time, end_time, examId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Exam not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete an exam
router.delete('/:examId', async (req, res) => {
    try {
        const { examId } = req.params;
        const result = await pool.query('DELETE FROM exams WHERE id = $1 RETURNING *', [examId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Exam not found' });
        }
        res.json({ message: 'Exam deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
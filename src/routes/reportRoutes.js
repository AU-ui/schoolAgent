const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all reports
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reports');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new report
router.post('/', async (req, res) => {
    try {
        const { student_id, subject_id, grade, comments } = req.body;
        const result = await pool.query(
            'INSERT INTO reports (student_id, subject_id, grade, comments) VALUES ($1, $2, $3, $4) RETURNING *',
            [student_id, subject_id, grade, comments]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a report
router.put('/:reportId', async (req, res) => {
    try {
        const { reportId } = req.params;
        const { grade, comments } = req.body;
        const result = await pool.query(
            'UPDATE reports SET grade = $1, comments = $2 WHERE id = $3 RETURNING *',
            [grade, comments, reportId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a report
router.delete('/:reportId', async (req, res) => {
    try {
        const { reportId } = req.params;
        const result = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING *', [reportId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }
        res.json({ message: 'Report deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all timetables
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM timetables');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new timetable
router.post('/', async (req, res) => {
    try {
        const { class_id, day, period_number, subject_id, teacher_id } = req.body;
        const result = await pool.query(
            'INSERT INTO timetables (class_id, day, period_number, subject_id, teacher_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [class_id, day, period_number, subject_id, teacher_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a timetable
router.put('/:timetableId', async (req, res) => {
    try {
        const { timetableId } = req.params;
        const { day, period_number, subject_id, teacher_id } = req.body;
        const result = await pool.query(
            'UPDATE timetables SET day = $1, period_number = $2, subject_id = $3, teacher_id = $4 WHERE id = $5 RETURNING *',
            [day, period_number, subject_id, teacher_id, timetableId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Timetable not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a timetable
router.delete('/:timetableId', async (req, res) => {
    try {
        const { timetableId } = req.params;
        const result = await pool.query('DELETE FROM timetables WHERE id = $1 RETURNING *', [timetableId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Timetable not found' });
        }
        res.json({ message: 'Timetable deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
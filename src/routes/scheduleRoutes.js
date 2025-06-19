const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all schedules
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM schedules');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new schedule
router.post('/', async (req, res) => {
    try {
        const { class_id, subject_id, start_time, end_time } = req.body;
        const result = await pool.query(
            'INSERT INTO schedules (class_id, subject_id, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
            [class_id, subject_id, start_time, end_time]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a schedule
router.put('/:scheduleId', async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const { start_time, end_time } = req.body;
        const result = await pool.query(
            'UPDATE schedules SET start_time = $1, end_time = $2 WHERE id = $3 RETURNING *',
            [start_time, end_time, scheduleId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a schedule
router.delete('/:scheduleId', async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const result = await pool.query('DELETE FROM schedules WHERE id = $1 RETURNING *', [scheduleId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        res.json({ message: 'Schedule deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
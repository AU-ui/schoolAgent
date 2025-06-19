const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all attendance records
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM attendance');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new attendance record
router.post('/', async (req, res) => {
    try {
        const { student_id, date, status } = req.body;
        const result = await pool.query(
            'INSERT INTO attendance (student_id, date, status) VALUES ($1, $2, $3) RETURNING *',
            [student_id, date, status]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update an attendance record
router.put('/:attendanceId', async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { status } = req.body;
        const result = await pool.query(
            'UPDATE attendance SET status = $1 WHERE id = $2 RETURNING *',
            [status, attendanceId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete an attendance record
router.delete('/:attendanceId', async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const result = await pool.query('DELETE FROM attendance WHERE id = $1 RETURNING *', [attendanceId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }
        res.json({ message: 'Attendance record deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
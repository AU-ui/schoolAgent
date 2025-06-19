const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all holidays
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM holidays');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new holiday
router.post('/', async (req, res) => {
    try {
        const { name, start_date, end_date, description } = req.body;
        const result = await pool.query(
            'INSERT INTO holidays (name, start_date, end_date, description) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, start_date, end_date, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a holiday
router.put('/:holidayId', async (req, res) => {
    try {
        const { holidayId } = req.params;
        const { name, start_date, end_date, description } = req.body;
        const result = await pool.query(
            'UPDATE holidays SET name = $1, start_date = $2, end_date = $3, description = $4 WHERE id = $5 RETURNING *',
            [name, start_date, end_date, description, holidayId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Holiday not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a holiday
router.delete('/:holidayId', async (req, res) => {
    try {
        const { holidayId } = req.params;
        const result = await pool.query('DELETE FROM holidays WHERE id = $1 RETURNING *', [holidayId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Holiday not found' });
        }
        res.json({ message: 'Holiday deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
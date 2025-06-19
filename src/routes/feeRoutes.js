const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all fees
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM fees');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new fee
router.post('/', async (req, res) => {
    try {
        const { student_id, amount, due_date } = req.body;
        const result = await pool.query(
            'INSERT INTO fees (student_id, amount, due_date) VALUES ($1, $2, $3) RETURNING *',
            [student_id, amount, due_date]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a fee
router.put('/:feeId', async (req, res) => {
    try {
        const { feeId } = req.params;
        const { amount, due_date } = req.body;
        const result = await pool.query(
            'UPDATE fees SET amount = $1, due_date = $2 WHERE id = $3 RETURNING *',
            [amount, due_date, feeId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Fee not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a fee
router.delete('/:feeId', async (req, res) => {
    try {
        const { feeId } = req.params;
        const result = await pool.query('DELETE FROM fees WHERE id = $1 RETURNING *', [feeId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Fee not found' });
        }
        res.json({ message: 'Fee deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
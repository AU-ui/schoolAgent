const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all complaints
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM complaints');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new complaint
router.post('/', async (req, res) => {
    try {
        const { user_id, subject, description, status } = req.body;
        const result = await pool.query(
            'INSERT INTO complaints (user_id, subject, description, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [user_id, subject, description, status]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a complaint
router.put('/:complaintId', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { subject, description, status } = req.body;
        const result = await pool.query(
            'UPDATE complaints SET subject = $1, description = $2, status = $3 WHERE id = $4 RETURNING *',
            [subject, description, status, complaintId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Complaint not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a complaint
router.delete('/:complaintId', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const result = await pool.query('DELETE FROM complaints WHERE id = $1 RETURNING *', [complaintId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Complaint not found' });
        }
        res.json({ message: 'Complaint deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
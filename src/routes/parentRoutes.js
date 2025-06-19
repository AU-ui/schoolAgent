const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all parents
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM parents');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new parent
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;
        const result = await pool.query(
            'INSERT INTO parents (name, email, phone, address) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, phone, address]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a parent
router.put('/:parentId', async (req, res) => {
    try {
        const { parentId } = req.params;
        const { name, email, phone, address } = req.body;
        const result = await pool.query(
            'UPDATE parents SET name = $1, email = $2, phone = $3, address = $4 WHERE id = $5 RETURNING *',
            [name, email, phone, address, parentId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Parent not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a parent
router.delete('/:parentId', async (req, res) => {
    try {
        const { parentId } = req.params;
        const result = await pool.query('DELETE FROM parents WHERE id = $1 RETURNING *', [parentId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Parent not found' });
        }
        res.json({ message: 'Parent deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
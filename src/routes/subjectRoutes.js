const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all subjects
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM subjects');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new subject
router.post('/', async (req, res) => {
    try {
        const { name, class_id } = req.body;
        const result = await pool.query(
            'INSERT INTO subjects (name, class_id) VALUES ($1, $2) RETURNING *',
            [name, class_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a subject
router.put('/:subjectId', async (req, res) => {
    try {
        const { subjectId } = req.params;
        const { name, class_id } = req.body;
        const result = await pool.query(
            'UPDATE subjects SET name = $1, class_id = $2 WHERE id = $3 RETURNING *',
            [name, class_id, subjectId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Subject not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a subject
router.delete('/:subjectId', async (req, res) => {
    try {
        const { subjectId } = req.params;
        const result = await pool.query('DELETE FROM subjects WHERE id = $1 RETURNING *', [subjectId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Subject not found' });
        }
        res.json({ message: 'Subject deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
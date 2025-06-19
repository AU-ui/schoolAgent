const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all classes
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM classes');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new class
router.post('/', async (req, res) => {
    try {
        const { name, teacher_id } = req.body;
        const result = await pool.query(
            'INSERT INTO classes (name, teacher_id) VALUES ($1, $2) RETURNING *',
            [name, teacher_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a class
router.put('/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const { name, teacher_id } = req.body;
        const result = await pool.query(
            'UPDATE classes SET name = $1, teacher_id = $2 WHERE id = $3 RETURNING *',
            [name, teacher_id, classId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a class
router.delete('/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const result = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING *', [classId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }
        res.json({ message: 'Class deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all events
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM events');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new event
router.post('/', async (req, res) => {
    try {
        const { title, description, date, location, organizer } = req.body;
        const result = await pool.query(
            'INSERT INTO events (title, description, date, location, organizer) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [title, description, date, location, organizer]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update an event
router.put('/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { title, description, date, location, organizer } = req.body;
        const result = await pool.query(
            'UPDATE events SET title = $1, description = $2, date = $3, location = $4, organizer = $5 WHERE id = $6 RETURNING *',
            [title, description, date, location, organizer, eventId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete an event
router.delete('/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING *', [eventId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json({ message: 'Event deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
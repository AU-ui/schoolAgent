const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all notifications
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM notifications');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new notification
router.post('/', async (req, res) => {
    try {
        const { user_id, message } = req.body;
        const result = await pool.query(
            'INSERT INTO notifications (user_id, message) VALUES ($1, $2) RETURNING *',
            [user_id, message]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a notification
router.put('/:notificationId', async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { message } = req.body;
        const result = await pool.query(
            'UPDATE notifications SET message = $1 WHERE id = $2 RETURNING *',
            [message, notificationId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a notification
router.delete('/:notificationId', async (req, res) => {
    try {
        const { notificationId } = req.params;
        const result = await pool.query('DELETE FROM notifications WHERE id = $1 RETURNING *', [notificationId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.json({ message: 'Notification deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
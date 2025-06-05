const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get messages for the authenticated parent
router.get('/parent/messages', async (req, res) => {
    try {
        // In a real application, parentId would come from the authenticated user's session/token
        const parentId = req.user.id; // This will be set by authentication middleware
        
        const result = await pool.query(
            `SELECT pm.*, 
                    t.name as teacher_name, 
                    t.email as teacher_email
             FROM parent_messages pm
             JOIN users t ON pm.teacher_id = t.id
             WHERE pm.parent_id = $1
             ORDER BY pm.created_at DESC`,
            [parentId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get messages for the authenticated teacher
router.get('/teacher/messages', async (req, res) => {
    try {
        // In a real application, teacherId would come from the authenticated user's session/token
        const teacherId = req.user.id; // This will be set by authentication middleware
        
        const result = await pool.query(
            `SELECT pm.*, 
                    p.name as parent_name, 
                    p.email as parent_email
             FROM parent_messages pm
             JOIN users p ON pm.parent_id = p.id
             WHERE pm.teacher_id = $1
             ORDER BY pm.created_at DESC`,
            [teacherId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Send new message (can be from parent to teacher or teacher to parent)
router.post('/', async (req, res) => {
    try {
        const { teacher_id, parent_id, message } = req.body;
        
        const result = await pool.query(
            'INSERT INTO parent_messages (teacher_id, parent_id, message, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [teacher_id, parent_id, message, 'sent']
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update message status (mark as read)
router.patch('/:messageId/status', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { status } = req.body;
        
        const result = await pool.query(
            'UPDATE parent_messages SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, messageId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Message not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get unread message count for a user
router.get('/unread/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            `SELECT COUNT(*) 
             FROM parent_messages 
             WHERE (parent_id = $1 OR teacher_id = $1) 
             AND status = 'sent'`,
            [userId]
        );
        res.json({ unreadCount: parseInt(result.rows[0].count) });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get conversation between parent and teacher
router.get('/conversation/:parentId/:teacherId', async (req, res) => {
    try {
        const { parentId, teacherId } = req.params;
        const result = await pool.query(
            `SELECT pm.*, 
                    t.name as teacher_name, 
                    p.name as parent_name
             FROM parent_messages pm
             JOIN users t ON pm.teacher_id = t.id
             JOIN users p ON pm.parent_id = p.id
             WHERE (pm.parent_id = $1 AND pm.teacher_id = $2)
             OR (pm.parent_id = $2 AND pm.teacher_id = $1)
             ORDER BY pm.created_at ASC`,
            [parentId, teacherId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
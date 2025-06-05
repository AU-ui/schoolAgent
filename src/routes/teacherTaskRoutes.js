const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all tasks for a teacher
router.get('/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        const result = await pool.query(
            'SELECT * FROM teacher_tasks WHERE teacher_id = $1 ORDER BY due_date ASC',
            [teacherId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create new task
router.post('/', async (req, res) => {
    try {
        const { teacher_id, title, description, due_date, priority } = req.body;
        
        const result = await pool.query(
            'INSERT INTO teacher_tasks (teacher_id, title, description, due_date, status, priority) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [teacher_id, title, description, due_date, 'pending', priority]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update task status
router.patch('/:taskId/status', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        
        const result = await pool.query(
            'UPDATE teacher_tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, taskId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update task details
router.put('/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { title, description, due_date, priority } = req.body;
        
        const result = await pool.query(
            'UPDATE teacher_tasks SET title = $1, description = $2, due_date = $3, priority = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
            [title, description, due_date, priority, taskId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete task
router.delete('/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        
        const result = await pool.query(
            'DELETE FROM teacher_tasks WHERE id = $1 RETURNING *',
            [taskId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get tasks by status
router.get('/:teacherId/status/:status', async (req, res) => {
    try {
        const { teacherId, status } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM teacher_tasks WHERE teacher_id = $1 AND status = $2 ORDER BY due_date ASC',
            [teacherId, status]
        );
        
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get tasks by priority
router.get('/:teacherId/priority/:priority', async (req, res) => {
    try {
        const { teacherId, priority } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM teacher_tasks WHERE teacher_id = $1 AND priority = $2 ORDER BY due_date ASC',
            [teacherId, priority]
        );
        
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
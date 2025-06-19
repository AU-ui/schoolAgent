const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

/**
 * @swagger
 * /api/teacher-tasks/{teacherId}:
 *   get:
 *     summary: Get all tasks for a teacher
 *     tags: [Teacher Tasks]
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the teacher
 *     responses:
 *       200:
 *         description: List of tasks retrieved successfully
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/teacher-tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Teacher Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teacher_id
 *               - title
 *               - description
 *               - due_date
 *               - priority
 *             properties:
 *               teacher_id:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date
 *               priority:
 *                 type: string
 *     responses:
 *       201:
 *         description: Task created successfully
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/teacher-tasks/{taskId}/status:
 *   patch:
 *     summary: Update task status
 *     tags: [Teacher Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the task
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task status updated successfully
 *       404:
 *         description: Task not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/teacher-tasks/{taskId}:
 *   put:
 *     summary: Update task details
 *     tags: [Teacher Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the task
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - due_date
 *               - priority
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date
 *               priority:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task details updated successfully
 *       404:
 *         description: Task not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/teacher-tasks/{taskId}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Teacher Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the task
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       404:
 *         description: Task not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/teacher-tasks/{teacherId}/status/{status}:
 *   get:
 *     summary: Get tasks by status
 *     tags: [Teacher Tasks]
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the teacher
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *         description: Status of the tasks
 *     responses:
 *       200:
 *         description: List of tasks retrieved successfully
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/teacher-tasks/{teacherId}/priority/{priority}:
 *   get:
 *     summary: Get tasks by priority
 *     tags: [Teacher Tasks]
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the teacher
 *       - in: path
 *         name: priority
 *         required: true
 *         schema:
 *           type: string
 *         description: Priority of the tasks
 *     responses:
 *       200:
 *         description: List of tasks retrieved successfully
 *       500:
 *         description: Server error
 */
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
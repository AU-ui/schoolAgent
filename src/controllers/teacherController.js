const pool = require('../config/db');

// Get teacher's classes
const getTeacherClasses = async (req, res) => {
    try {
        const teacherId = req.user.id;

        const classes = await pool.query(
            `SELECT c.*, COUNT(s.id) as student_count 
             FROM classes c 
             LEFT JOIN students s ON c.id = s.class_id 
             WHERE c.teacher_id = $1 
             GROUP BY c.id`,
            [teacherId]
        );

        res.json(classes.rows);
    } catch (error) {
        console.error('Error fetching teacher classes:', error);
        res.status(500).json({ message: 'Server error while fetching classes' });
    }
};

// Get teacher's tasks
const getTeacherTasks = async (req, res) => {
    try {
        const teacherId = req.user.id;

        const tasks = await pool.query(
            `SELECT * FROM tasks 
             WHERE assigned_to = $1 
             ORDER BY due_date ASC`,
            [teacherId]
        );

        res.json(tasks.rows);
    } catch (error) {
        console.error('Error fetching teacher tasks:', error);
        res.status(500).json({ message: 'Server error while fetching tasks' });
    }
};

// Create a new task
const createTask = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { title, description, priority, due_date } = req.body;

        const newTask = await pool.query(
            'INSERT INTO teacher_tasks (teacher_id, title, description, priority, due_date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [teacherId, title, description, priority, due_date, 'pending']
        );

        res.status(201).json(newTask.rows[0]);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Server error while creating task' });
    }
};

// Update task status
const updateTaskStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        const teacherId = req.user.id;

        // Verify task belongs to teacher
        const task = await pool.query(
            'SELECT * FROM teacher_tasks WHERE id = $1 AND teacher_id = $2',
            [taskId, teacherId]
        );

        if (task.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const updatedTask = await pool.query(
            'UPDATE teacher_tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, taskId]
        );

        res.json(updatedTask.rows[0]);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Server error while updating task' });
    }
};

// Delete a task
const deleteTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const teacherId = req.user.id;

        // Verify task belongs to teacher
        const task = await pool.query(
            'SELECT * FROM teacher_tasks WHERE id = $1 AND teacher_id = $2',
            [taskId, teacherId]
        );

        if (task.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        await pool.query('DELETE FROM teacher_tasks WHERE id = $1', [taskId]);

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Server error while deleting task' });
    }
};

// Get teacher's messages
const getTeacherMessages = async (req, res) => {
    try {
        const teacherId = req.user.id;

        const messages = await pool.query(
            `SELECT m.*, p.name as parent_name 
             FROM parent_messages m 
             JOIN users p ON m.parent_id = p.id 
             WHERE m.teacher_id = $1 
             ORDER BY m.created_at DESC`,
            [teacherId]
        );

        res.json(messages.rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error while fetching messages' });
    }
};

// Send message to parent
const sendMessageToParent = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { parentId, message } = req.body;

        const newMessage = await pool.query(
            'INSERT INTO parent_messages (teacher_id, parent_id, message, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [teacherId, parentId, message, 'sent']
        );

        res.status(201).json(newMessage.rows[0]);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Server error while sending message' });
    }
};

module.exports = {
    getTeacherClasses,
    getTeacherTasks,
    createTask,
    updateTaskStatus,
    deleteTask,
    getTeacherMessages,
    sendMessageToParent
}; 
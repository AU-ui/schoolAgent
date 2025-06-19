const pool = require('../config/db');

// Create a new task
const createTask = async (req, res) => {
    try {
        const { title, description, assigned_to, due_date, priority, category, status } = req.body;

        const newTask = await pool.query(
            `INSERT INTO tasks (title, description, assigned_to, due_date, 
                               priority, category, status, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [title, description, assigned_to, due_date, priority, category, status]
        );

        // Create notification for assigned user
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, reference_id, created_at) 
             VALUES ($1, 'new_task', 'New Task Assigned', $2, $3, CURRENT_TIMESTAMP)`,
            [assigned_to, title, newTask.rows[0].id]
        );

        res.status(201).json(newTask.rows[0]);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Server error while creating task' });
    }
};

// Get all tasks
const getAllTasks = async (req, res) => {
    try {
        const { status, category, priority, assigned_to } = req.query;

        let query = `
            SELECT t.*, 
                   u.name as assigned_to_name,
                   u.role as assigned_to_role
            FROM tasks t
            JOIN users u ON t.assigned_to = u.id
            WHERE 1=1
        `;
        const queryParams = [];

        if (status) {
            query += ' AND t.status = $' + (queryParams.length + 1);
            queryParams.push(status);
        }

        if (category) {
            query += ' AND t.category = $' + (queryParams.length + 1);
            queryParams.push(category);
        }

        if (priority) {
            query += ' AND t.priority = $' + (queryParams.length + 1);
            queryParams.push(priority);
        }

        if (assigned_to) {
            query += ' AND t.assigned_to = $' + (queryParams.length + 1);
            queryParams.push(assigned_to);
        }

        query += ' ORDER BY t.due_date ASC, t.priority DESC';

        const tasks = await pool.query(query, queryParams);
        res.json(tasks.rows);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Server error while fetching tasks' });
    }
};

// Get task by ID
const getTaskById = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await pool.query(
            `SELECT t.*, 
                    u.name as assigned_to_name,
                    u.role as assigned_to_role
             FROM tasks t
             JOIN users u ON t.assigned_to = u.id
             WHERE t.id = $1`,
            [id]
        );

        if (task.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.json(task.rows[0]);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ message: 'Server error while fetching task' });
    }
};

// Update task
const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, assigned_to, due_date, priority, category, status } = req.body;

        const updatedTask = await pool.query(
            `UPDATE tasks 
             SET title = $1, 
                 description = $2, 
                 assigned_to = $3, 
                 due_date = $4, 
                 priority = $5, 
                 category = $6, 
                 status = $7,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $8 
             RETURNING *`,
            [title, description, assigned_to, due_date, priority, category, status, id]
        );

        if (updatedTask.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Create notification if task is reassigned
        if (assigned_to !== updatedTask.rows[0].assigned_to) {
            await pool.query(
                `INSERT INTO notifications (user_id, type, title, message, reference_id, created_at) 
                 VALUES ($1, 'task_reassigned', 'Task Reassigned', $2, $3, CURRENT_TIMESTAMP)`,
                [assigned_to, title, id]
            );
        }

        res.json(updatedTask.rows[0]);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Server error while updating task' });
    }
};

// Delete task
const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedTask = await pool.query(
            'DELETE FROM tasks WHERE id = $1 RETURNING *',
            [id]
        );

        if (deletedTask.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Server error while deleting task' });
    }
};

// Get tasks by user
const getUserTasks = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { status, category } = req.query;

        let query = `
            SELECT t.*, 
                   u.name as assigned_to_name,
                   u.role as assigned_to_role
            FROM tasks t
            JOIN users u ON t.assigned_to = u.id
            WHERE t.assigned_to = $1
        `;
        const queryParams = [user_id];

        if (status) {
            query += ' AND t.status = $' + (queryParams.length + 1);
            queryParams.push(status);
        }

        if (category) {
            query += ' AND t.category = $' + (queryParams.length + 1);
            queryParams.push(category);
        }

        query += ' ORDER BY t.due_date ASC, t.priority DESC';

        const tasks = await pool.query(query, queryParams);
        res.json(tasks.rows);
    } catch (error) {
        console.error('Error fetching user tasks:', error);
        res.status(500).json({ message: 'Server error while fetching tasks' });
    }
};

// Get task categories
const getTaskCategories = async (req, res) => {
    try {
        const categories = await pool.query(
            `SELECT DISTINCT category 
             FROM tasks 
             ORDER BY category`
        );

        res.json(categories.rows.map(row => row.category));
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Server error while fetching categories' });
    }
};

// Get overdue tasks
const getOverdueTasks = async (req, res) => {
    try {
        const tasks = await pool.query(
            `SELECT t.*, 
                    u.name as assigned_to_name,
                    u.role as assigned_to_role
             FROM tasks t
             JOIN users u ON t.assigned_to = u.id
             WHERE t.due_date < CURRENT_DATE 
             AND t.status != 'completed'
             ORDER BY t.due_date ASC`
        );

        res.json(tasks.rows);
    } catch (error) {
        console.error('Error fetching overdue tasks:', error);
        res.status(500).json({ message: 'Server error while fetching overdue tasks' });
    }
};

// Get upcoming tasks
const getUpcomingTasks = async (req, res) => {
    try {
        const { days = 7 } = req.query;

        const tasks = await pool.query(
            `SELECT t.*, 
                    u.name as assigned_to_name,
                    u.role as assigned_to_role
             FROM tasks t
             JOIN users u ON t.assigned_to = u.id
             WHERE t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1
             AND t.status != 'completed'
             ORDER BY t.due_date ASC, t.priority DESC`,
            [days]
        );

        res.json(tasks.rows);
    } catch (error) {
        console.error('Error fetching upcoming tasks:', error);
        res.status(500).json({ message: 'Server error while fetching upcoming tasks' });
    }
};

module.exports = {
    createTask,
    getAllTasks,
    getTaskById,
    updateTask,
    deleteTask,
    getUserTasks,
    getTaskCategories,
    getOverdueTasks,
    getUpcomingTasks
}; 
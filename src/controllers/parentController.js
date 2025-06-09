const pool = require('../config/db');

// Get all messages for a parent
const getParentMessages = async (req, res) => {
    try {
        const parentId = req.user.id;

        const messages = await pool.query(
            `SELECT m.*, t.name as teacher_name 
             FROM parent_messages m 
             JOIN users t ON m.teacher_id = t.id 
             WHERE m.parent_id = $1 
             ORDER BY m.created_at DESC`,
            [parentId]
        );

        res.json(messages.rows);
    } catch (error) {
        console.error('Error fetching parent messages:', error);
        res.status(500).json({ message: 'Server error while fetching messages' });
    }
};

// Send message to teacher
const sendMessageToTeacher = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { teacherId, message } = req.body;

        const newMessage = await pool.query(
            'INSERT INTO parent_messages (parent_id, teacher_id, message, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [parentId, teacherId, message, 'sent']
        );

        res.status(201).json(newMessage.rows[0]);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Server error while sending message' });
    }
};

// Get parent's children
const getChildren = async (req, res) => {
    try {
        const parentId = req.user.id;

        const children = await pool.query(
            `SELECT s.*, c.name as class_name 
             FROM students s 
             JOIN classes c ON s.class_id = c.id 
             WHERE s.parent_id = $1`,
            [parentId]
        );

        res.json(children.rows);
    } catch (error) {
        console.error('Error fetching children:', error);
        res.status(500).json({ message: 'Server error while fetching children' });
    }
};

// Get child's details
const getChildDetails = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { childId } = req.params;

        // Verify child belongs to parent
        const child = await pool.query(
            `SELECT s.*, c.name as class_name 
             FROM students s 
             JOIN classes c ON s.class_id = c.id 
             WHERE s.id = $1 AND s.parent_id = $2`,
            [childId, parentId]
        );

        if (child.rows.length === 0) {
            return res.status(404).json({ message: 'Child not found' });
        }

        res.json(child.rows[0]);
    } catch (error) {
        console.error('Error fetching child details:', error);
        res.status(500).json({ message: 'Server error while fetching child details' });
    }
};

// Update parent profile
const updateProfile = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { name, email, phone } = req.body;

        const updatedParent = await pool.query(
            'UPDATE users SET name = $1, email = $2, phone = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [name, email, phone, parentId]
        );

        res.json(updatedParent.rows[0]);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error while updating profile' });
    }
};

module.exports = {
    getParentMessages,
    sendMessageToTeacher,
    getChildren,
    getChildDetails,
    updateProfile
}; 
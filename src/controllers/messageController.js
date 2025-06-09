const pool = require('../config/db');

// Send a new message
const sendMessage = async (req, res) => {
    try {
        const { sender_id, receiver_id, subject, content, category, priority } = req.body;

        const newMessage = await pool.query(
            `INSERT INTO messages (sender_id, receiver_id, subject, content, 
                                 category, priority, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [sender_id, receiver_id, subject, content, category, priority]
        );

        // Create notification for receiver
        await pool.query(
            `INSERT INTO notifications (user_id, message_id, type, created_at) 
             VALUES ($1, $2, 'new_message', CURRENT_TIMESTAMP)`,
            [receiver_id, newMessage.rows[0].id]
        );

        res.status(201).json(newMessage.rows[0]);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Server error while sending message' });
    }
};

// Get all messages for a user
const getUserMessages = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { category, status } = req.query;

        let query = `
            SELECT m.*, 
                   s.name as sender_name, 
                   r.name as receiver_name,
                   s.role as sender_role,
                   r.role as receiver_role
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            JOIN users r ON m.receiver_id = r.id
            WHERE m.sender_id = $1 OR m.receiver_id = $1
        `;
        const queryParams = [user_id];

        if (category) {
            query += ' AND m.category = $' + (queryParams.length + 1);
            queryParams.push(category);
        }

        if (status) {
            query += ' AND m.status = $' + (queryParams.length + 1);
            queryParams.push(status);
        }

        query += ' ORDER BY m.created_at DESC';

        const messages = await pool.query(query, queryParams);
        res.json(messages.rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error while fetching messages' });
    }
};

// Get a specific message
const getMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.user; // From auth middleware

        const message = await pool.query(
            `SELECT m.*, 
                    s.name as sender_name, 
                    r.name as receiver_name,
                    s.role as sender_role,
                    r.role as receiver_role
             FROM messages m
             JOIN users s ON m.sender_id = s.id
             JOIN users r ON m.receiver_id = r.id
             WHERE m.id = $1 AND (m.sender_id = $2 OR m.receiver_id = $2)`,
            [id, user_id]
        );

        if (message.rows.length === 0) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Mark message as read if receiver is viewing it
        if (message.rows[0].receiver_id === user_id && message.rows[0].status === 'unread') {
            await pool.query(
                'UPDATE messages SET status = $1, read_at = CURRENT_TIMESTAMP WHERE id = $2',
                ['read', id]
            );
        }

        res.json(message.rows[0]);
    } catch (error) {
        console.error('Error fetching message:', error);
        res.status(500).json({ message: 'Server error while fetching message' });
    }
};

// Update message status
const updateMessageStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { user_id } = req.user;

        const updatedMessage = await pool.query(
            `UPDATE messages 
             SET status = $1, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2 AND (sender_id = $3 OR receiver_id = $3) 
             RETURNING *`,
            [status, id, user_id]
        );

        if (updatedMessage.rows.length === 0) {
            return res.status(404).json({ message: 'Message not found' });
        }

        res.json(updatedMessage.rows[0]);
    } catch (error) {
        console.error('Error updating message status:', error);
        res.status(500).json({ message: 'Server error while updating message status' });
    }
};

// Delete a message
const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.user;

        const deletedMessage = await pool.query(
            `DELETE FROM messages 
             WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2) 
             RETURNING *`,
            [id, user_id]
        );

        if (deletedMessage.rows.length === 0) {
            return res.status(404).json({ message: 'Message not found' });
        }

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ message: 'Server error while deleting message' });
    }
};

// Get unread message count
const getUnreadCount = async (req, res) => {
    try {
        const { user_id } = req.params;

        const count = await pool.query(
            `SELECT COUNT(*) 
             FROM messages 
             WHERE receiver_id = $1 AND status = 'unread'`,
            [user_id]
        );

        res.json({ unread_count: parseInt(count.rows[0].count) });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Server error while fetching unread count' });
    }
};

// Get message categories
const getMessageCategories = async (req, res) => {
    try {
        const categories = await pool.query(
            `SELECT DISTINCT category 
             FROM messages 
             ORDER BY category`
        );

        res.json(categories.rows.map(row => row.category));
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Server error while fetching categories' });
    }
};

// Search messages
const searchMessages = async (req, res) => {
    try {
        const { user_id } = req.user;
        const { query, category, start_date, end_date } = req.query;

        let searchQuery = `
            SELECT m.*, 
                   s.name as sender_name, 
                   r.name as receiver_name
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            JOIN users r ON m.receiver_id = r.id
            WHERE (m.sender_id = $1 OR m.receiver_id = $1)
            AND (
                m.subject ILIKE $2 
                OR m.content ILIKE $2
                OR s.name ILIKE $2
                OR r.name ILIKE $2
            )
        `;
        const queryParams = [user_id, `%${query}%`];

        if (category) {
            searchQuery += ' AND m.category = $' + (queryParams.length + 1);
            queryParams.push(category);
        }

        if (start_date) {
            searchQuery += ' AND m.created_at >= $' + (queryParams.length + 1);
            queryParams.push(start_date);
        }

        if (end_date) {
            searchQuery += ' AND m.created_at <= $' + (queryParams.length + 1);
            queryParams.push(end_date);
        }

        searchQuery += ' ORDER BY m.created_at DESC';

        const messages = await pool.query(searchQuery, queryParams);
        res.json(messages.rows);
    } catch (error) {
        console.error('Error searching messages:', error);
        res.status(500).json({ message: 'Server error while searching messages' });
    }
};

module.exports = {
    sendMessage,
    getUserMessages,
    getMessage,
    updateMessageStatus,
    deleteMessage,
    getUnreadCount,
    getMessageCategories,
    searchMessages
}; 
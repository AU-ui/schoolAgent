const pool = require('../config/db');

// Create a new notification
const createNotification = async (req, res) => {
    try {
        const { user_id, type, title, message, reference_id, priority } = req.body;

        const newNotification = await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, 
                                      reference_id, priority, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [user_id, type, title, message, reference_id, priority]
        );

        res.status(201).json(newNotification.rows[0]);
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ message: 'Server error while creating notification' });
    }
};

// Get all notifications for a user
const getUserNotifications = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { type, status } = req.query;

        let query = `
            SELECT * FROM notifications 
            WHERE user_id = $1
        `;
        const queryParams = [user_id];

        if (type) {
            query += ' AND type = $' + (queryParams.length + 1);
            queryParams.push(type);
        }

        if (status) {
            query += ' AND status = $' + (queryParams.length + 1);
            queryParams.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const notifications = await pool.query(query, queryParams);
        res.json(notifications.rows);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error while fetching notifications' });
    }
};

// Mark notification as read
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.user;

        const updatedNotification = await pool.query(
            `UPDATE notifications 
             SET status = 'read', 
                 read_at = CURRENT_TIMESTAMP 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [id, user_id]
        );

        if (updatedNotification.rows.length === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json(updatedNotification.rows[0]);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Server error while updating notification' });
    }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
    try {
        const { user_id } = req.user;

        const updatedNotifications = await pool.query(
            `UPDATE notifications 
             SET status = 'read', 
                 read_at = CURRENT_TIMESTAMP 
             WHERE user_id = $1 AND status = 'unread' 
             RETURNING *`,
            [user_id]
        );

        res.json({ 
            message: 'All notifications marked as read',
            count: updatedNotifications.rows.length 
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Server error while updating notifications' });
    }
};

// Delete a notification
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.user;

        const deletedNotification = await pool.query(
            `DELETE FROM notifications 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [id, user_id]
        );

        if (deletedNotification.rows.length === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Server error while deleting notification' });
    }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
    try {
        const { user_id } = req.params;

        const count = await pool.query(
            `SELECT COUNT(*) 
             FROM notifications 
             WHERE user_id = $1 AND status = 'unread'`,
            [user_id]
        );

        res.json({ unread_count: parseInt(count.rows[0].count) });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Server error while fetching unread count' });
    }
};

// Update notification preferences
const updatePreferences = async (req, res) => {
    try {
        const { user_id } = req.user;
        const { email_notifications, push_notifications, notification_types } = req.body;

        const updatedPreferences = await pool.query(
            `INSERT INTO notification_preferences 
             (user_id, email_notifications, push_notifications, notification_types, updated_at) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
             ON CONFLICT (user_id) 
             DO UPDATE SET 
                email_notifications = $2,
                push_notifications = $3,
                notification_types = $4,
                updated_at = CURRENT_TIMESTAMP 
             RETURNING *`,
            [user_id, email_notifications, push_notifications, notification_types]
        );

        res.json(updatedPreferences.rows[0]);
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({ message: 'Server error while updating preferences' });
    }
};

// Get notification preferences
const getPreferences = async (req, res) => {
    try {
        const { user_id } = req.params;

        const preferences = await pool.query(
            `SELECT * FROM notification_preferences 
             WHERE user_id = $1`,
            [user_id]
        );

        if (preferences.rows.length === 0) {
            return res.json({
                email_notifications: true,
                push_notifications: true,
                notification_types: ['all']
            });
        }

        res.json(preferences.rows[0]);
    } catch (error) {
        console.error('Error fetching notification preferences:', error);
        res.status(500).json({ message: 'Server error while fetching preferences' });
    }
};

// Get notification types
const getNotificationTypes = async (req, res) => {
    try {
        const types = await pool.query(
            `SELECT DISTINCT type 
             FROM notifications 
             ORDER BY type`
        );

        res.json(types.rows.map(row => row.type));
    } catch (error) {
        console.error('Error fetching notification types:', error);
        res.status(500).json({ message: 'Server error while fetching types' });
    }
};

module.exports = {
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadCount,
    updatePreferences,
    getPreferences,
    getNotificationTypes
}; 
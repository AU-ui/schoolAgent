const pool = require('../config/db');

// Get all complaints
const getAllComplaints = async (req, res) => {
    try {
        const { status, type, priority, user_id } = req.query;
        let query = `
            SELECT 
                c.*,
                u.name as complainant_name,
                u.email as complainant_email,
                u.phone as complainant_phone,
                CASE 
                    WHEN c.status = 'pending' AND c.created_at < NOW() - INTERVAL '7 days' THEN 'overdue'
                    ELSE c.status
                END as current_status,
                COUNT(r.id) as total_responses
            FROM complaints c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN complaint_responses r ON c.id = r.complaint_id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ` AND c.status = $${params.length + 1}`;
            params.push(status);
        }

        if (type) {
            query += ` AND c.type = $${params.length + 1}`;
            params.push(type);
        }

        if (priority) {
            query += ` AND c.priority = $${params.length + 1}`;
            params.push(priority);
        }

        if (user_id) {
            query += ` AND c.user_id = $${params.length + 1}`;
            params.push(user_id);
        }

        query += ` GROUP BY c.id, u.name, u.email, u.phone ORDER BY 
            CASE 
                WHEN c.priority = 'high' THEN 1
                WHEN c.priority = 'medium' THEN 2
                WHEN c.priority = 'low' THEN 3
            END,
            c.created_at DESC`;

        const [complaints] = await pool.query(query, params);
        res.json(complaints);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ message: 'Server error while fetching complaints' });
    }
};

// Create complaint
const createComplaint = async (req, res) => {
    try {
        const {
            user_id,
            type,
            title,
            description,
            priority,
            attachments
        } = req.body;

        const [complaint] = await pool.query(
            `INSERT INTO complaints (
                user_id, type, title, description,
                priority, attachments, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
            RETURNING *`,
            [user_id, type, title, description, priority, attachments]
        );

        res.status(201).json(complaint);
    } catch (error) {
        console.error('Error creating complaint:', error);
        res.status(500).json({ message: 'Server error while creating complaint' });
    }
};

// Update complaint status
const updateComplaintStatus = async (req, res) => {
    try {
        const { complaint_id } = req.params;
        const { status, resolution_notes } = req.body;

        const [complaint] = await pool.query(
            `UPDATE complaints 
             SET status = $1,
                 resolution_notes = $2,
                 resolved_at = CASE 
                     WHEN $1 = 'resolved' THEN CURRENT_TIMESTAMP
                     ELSE resolved_at
                 END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [status, resolution_notes, complaint_id]
        );

        if (!complaint.length) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        res.json(complaint[0]);
    } catch (error) {
        console.error('Error updating complaint status:', error);
        res.status(500).json({ message: 'Server error while updating complaint status' });
    }
};

// Add complaint response
const addComplaintResponse = async (req, res) => {
    try {
        const { complaint_id } = req.params;
        const { user_id, response, is_internal } = req.body;

        const [response_record] = await pool.query(
            `INSERT INTO complaint_responses (
                complaint_id, user_id, response, is_internal
            ) VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [complaint_id, user_id, response, is_internal]
        );

        res.status(201).json(response_record);
    } catch (error) {
        console.error('Error adding complaint response:', error);
        res.status(500).json({ message: 'Server error while adding complaint response' });
    }
};

// Get complaint responses
const getComplaintResponses = async (req, res) => {
    try {
        const { complaint_id } = req.params;

        const [responses] = await pool.query(
            `SELECT 
                r.*,
                u.name as responder_name,
                u.role as responder_role
             FROM complaint_responses r
             JOIN users u ON r.user_id = u.id
             WHERE r.complaint_id = $1
             ORDER BY r.created_at`,
            [complaint_id]
        );

        res.json(responses);
    } catch (error) {
        console.error('Error fetching complaint responses:', error);
        res.status(500).json({ message: 'Server error while fetching complaint responses' });
    }
};

// Get user complaints
const getUserComplaints = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { status, type } = req.query;

        let query = `
            SELECT 
                c.*,
                COUNT(r.id) as total_responses,
                CASE 
                    WHEN c.status = 'pending' AND c.created_at < NOW() - INTERVAL '7 days' THEN 'overdue'
                    ELSE c.status
                END as current_status
            FROM complaints c
            LEFT JOIN complaint_responses r ON c.id = r.complaint_id
            WHERE c.user_id = $1
        `;
        const params = [user_id];

        if (status) {
            query += ` AND c.status = $${params.length + 1}`;
            params.push(status);
        }

        if (type) {
            query += ` AND c.type = $${params.length + 1}`;
            params.push(type);
        }

        query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

        const [complaints] = await pool.query(query, params);
        res.json(complaints);
    } catch (error) {
        console.error('Error fetching user complaints:', error);
        res.status(500).json({ message: 'Server error while fetching user complaints' });
    }
};

// Get complaint statistics
const getComplaintStats = async (req, res) => {
    try {
        const [stats] = await pool.query(
            `SELECT 
                COUNT(*) as total_complaints,
                COUNT(DISTINCT CASE WHEN status = 'pending' THEN id END) as pending_complaints,
                COUNT(DISTINCT CASE WHEN status = 'in_progress' THEN id END) as in_progress_complaints,
                COUNT(DISTINCT CASE WHEN status = 'resolved' THEN id END) as resolved_complaints,
                COUNT(DISTINCT CASE WHEN priority = 'high' THEN id END) as high_priority_complaints,
                COUNT(DISTINCT CASE WHEN priority = 'medium' THEN id END) as medium_priority_complaints,
                COUNT(DISTINCT CASE WHEN priority = 'low' THEN id END) as low_priority_complaints,
                COUNT(DISTINCT CASE 
                    WHEN status = 'pending' AND created_at < NOW() - INTERVAL '7 days' 
                    THEN id 
                END) as overdue_complaints
             FROM complaints`
        );

        // Get type-wise distribution
        const [typeStats] = await pool.query(
            `SELECT 
                type,
                COUNT(*) as total_complaints,
                COUNT(DISTINCT CASE WHEN status = 'resolved' THEN id END) as resolved_complaints,
                ROUND(AVG(
                    CASE 
                        WHEN status = 'resolved' 
                        THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
                        ELSE NULL 
                    END
                ), 2) as avg_resolution_hours
             FROM complaints
             GROUP BY type
             ORDER BY total_complaints DESC`
        );

        // Get monthly trend
        const [monthlyStats] = await pool.query(
            `SELECT 
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as total_complaints,
                COUNT(DISTINCT CASE WHEN status = 'resolved' THEN id END) as resolved_complaints
             FROM complaints
             GROUP BY DATE_TRUNC('month', created_at)
             ORDER BY month DESC
             LIMIT 12`
        );

        res.json({
            overall_stats: stats[0],
            type_stats: typeStats,
            monthly_stats: monthlyStats
        });
    } catch (error) {
        console.error('Error fetching complaint statistics:', error);
        res.status(500).json({ message: 'Server error while fetching complaint statistics' });
    }
};

module.exports = {
    getAllComplaints,
    createComplaint,
    updateComplaintStatus,
    addComplaintResponse,
    getComplaintResponses,
    getUserComplaints,
    getComplaintStats
}; 
const pool = require('../config/db');

// Get all events
const getAllEvents = async (req, res) => {
    try {
        const { start_date, end_date, type, status } = req.query;
        let query = `
            SELECT 
                e.*,
                c.name as category_name,
                COUNT(DISTINCT p.id) as total_participants,
                CASE 
                    WHEN e.start_date > CURRENT_DATE THEN 'upcoming'
                    WHEN e.end_date < CURRENT_DATE THEN 'completed'
                    ELSE 'ongoing'
                END as event_status
            FROM events e
            LEFT JOIN event_categories c ON e.category_id = c.id
            LEFT JOIN event_participants p ON e.id = p.event_id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND e.start_date >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND e.end_date <= $${params.length + 1}`;
            params.push(end_date);
        }

        if (type) {
            query += ` AND e.category_id = $${params.length + 1}`;
            params.push(type);
        }

        if (status) {
            query += ` AND CASE 
                WHEN e.start_date > CURRENT_DATE THEN 'upcoming'
                WHEN e.end_date < CURRENT_DATE THEN 'completed'
                ELSE 'ongoing'
            END = $${params.length + 1}`;
            params.push(status);
        }

        query += ` GROUP BY e.id, c.name ORDER BY e.start_date`;

        const [events] = await pool.query(query, params);
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Server error while fetching events' });
    }
};

// Create new event
const createEvent = async (req, res) => {
    try {
        const {
            title,
            description,
            category_id,
            start_date,
            end_date,
            venue,
            organizer,
            max_participants,
            registration_deadline,
            requirements,
            budget
        } = req.body;

        const [event] = await pool.query(
            `INSERT INTO events (
                title, description, category_id, start_date, end_date,
                venue, organizer, max_participants, registration_deadline,
                requirements, budget
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [title, description, category_id, start_date, end_date,
             venue, organizer, max_participants, registration_deadline,
             requirements, budget]
        );

        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Server error while creating event' });
    }
};

// Register for event
const registerForEvent = async (req, res) => {
    try {
        const { event_id, student_id, registration_date } = req.body;

        // Start transaction
        await pool.query('BEGIN');

        // Check event capacity
        const [event] = await pool.query(
            `SELECT 
                e.max_participants,
                COUNT(p.id) as current_participants,
                e.registration_deadline
             FROM events e
             LEFT JOIN event_participants p ON e.id = p.event_id
             WHERE e.id = $1
             GROUP BY e.id`,
            [event_id]
        );

        if (!event.length) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event[0].current_participants >= event[0].max_participants) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Event is full' });
        }

        if (new Date(registration_date) > new Date(event[0].registration_deadline)) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Registration deadline has passed' });
        }

        // Register participant
        const [registration] = await pool.query(
            `INSERT INTO event_participants (
                event_id, student_id, registration_date, status
            ) VALUES ($1, $2, $3, 'registered')
            RETURNING *`,
            [event_id, student_id, registration_date]
        );

        await pool.query('COMMIT');
        res.status(201).json(registration);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error registering for event:', error);
        res.status(500).json({ message: 'Server error while registering for event' });
    }
};

// Get event participants
const getEventParticipants = async (req, res) => {
    try {
        const { event_id } = req.params;

        const [participants] = await pool.query(
            `SELECT 
                p.*,
                s.name as student_name,
                s.admission_number,
                c.name as class_name,
                c.section
             FROM event_participants p
             JOIN students s ON p.student_id = s.id
             JOIN classes c ON s.class_id = c.id
             WHERE p.event_id = $1
             ORDER BY p.registration_date`,
            [event_id]
        );

        res.json(participants);
    } catch (error) {
        console.error('Error fetching event participants:', error);
        res.status(500).json({ message: 'Server error while fetching event participants' });
    }
};

// Update event status
const updateEventStatus = async (req, res) => {
    try {
        const { event_id } = req.params;
        const { status, notes } = req.body;

        const [event] = await pool.query(
            `UPDATE events 
             SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [status, notes, event_id]
        );

        if (!event.length) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json(event[0]);
    } catch (error) {
        console.error('Error updating event status:', error);
        res.status(500).json({ message: 'Server error while updating event status' });
    }
};

// Get student's events
const getStudentEvents = async (req, res) => {
    try {
        const { student_id, status } = req.query;

        const [events] = await pool.query(
            `SELECT 
                e.*,
                c.name as category_name,
                p.registration_date,
                p.status as participation_status
             FROM events e
             JOIN event_categories c ON e.category_id = c.id
             JOIN event_participants p ON e.id = p.event_id
             WHERE p.student_id = $1
             ${status ? 'AND p.status = $2' : ''}
             ORDER BY e.start_date DESC`,
            [student_id, status].filter(Boolean)
        );

        res.json(events);
    } catch (error) {
        console.error('Error fetching student events:', error);
        res.status(500).json({ message: 'Server error while fetching student events' });
    }
};

// Get event statistics
const getEventStats = async (req, res) => {
    try {
        const [stats] = await pool.query(
            `SELECT 
                COUNT(DISTINCT e.id) as total_events,
                COUNT(DISTINCT CASE WHEN e.start_date > CURRENT_DATE THEN e.id END) as upcoming_events,
                COUNT(DISTINCT CASE WHEN e.end_date < CURRENT_DATE THEN e.id END) as completed_events,
                COUNT(DISTINCT CASE WHEN e.start_date <= CURRENT_DATE AND e.end_date >= CURRENT_DATE THEN e.id END) as ongoing_events,
                COUNT(DISTINCT p.student_id) as total_participants,
                COUNT(DISTINCT e.category_id) as total_categories
             FROM events e
             LEFT JOIN event_participants p ON e.id = p.event_id`
        );

        // Get category-wise distribution
        const [categoryStats] = await pool.query(
            `SELECT 
                c.name as category,
                COUNT(DISTINCT e.id) as total_events,
                COUNT(DISTINCT p.student_id) as total_participants
             FROM event_categories c
             LEFT JOIN events e ON c.id = e.category_id
             LEFT JOIN event_participants p ON e.id = p.event_id
             GROUP BY c.id, c.name
             ORDER BY total_events DESC`
        );

        res.json({
            overall_stats: stats[0],
            category_stats: categoryStats
        });
    } catch (error) {
        console.error('Error fetching event statistics:', error);
        res.status(500).json({ message: 'Server error while fetching event statistics' });
    }
};

module.exports = {
    getAllEvents,
    createEvent,
    registerForEvent,
    getEventParticipants,
    updateEventStatus,
    getStudentEvents,
    getEventStats
}; 
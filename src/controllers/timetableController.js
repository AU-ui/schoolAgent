const pool = require('../config/db');

// Get class timetable
const getClassTimetable = async (req, res) => {
    try {
        const { class_id } = req.params;
        const { day } = req.query;

        let query = `
            SELECT 
                t.*,
                s.name as subject_name,
                s.code as subject_code,
                te.name as teacher_name,
                r.room_number,
                r.capacity
            FROM timetable t
            JOIN subjects s ON t.subject_id = s.id
            JOIN teachers te ON t.teacher_id = te.id
            JOIN rooms r ON t.room_id = r.id
            WHERE t.class_id = $1
        `;
        const params = [class_id];

        if (day) {
            query += ` AND t.day = $${params.length + 1}`;
            params.push(day);
        }

        query += ` ORDER BY t.day, t.start_time`;

        const [timetable] = await pool.query(query, params);
        res.json(timetable);
    } catch (error) {
        console.error('Error fetching timetable:', error);
        res.status(500).json({ message: 'Server error while fetching timetable' });
    }
};

// Create timetable slot
const createTimetableSlot = async (req, res) => {
    try {
        const {
            class_id,
            subject_id,
            teacher_id,
            room_id,
            day,
            start_time,
            end_time,
            period_number
        } = req.body;

        // Check for conflicts
        const [conflicts] = await pool.query(
            `SELECT * FROM timetable 
             WHERE (
                (class_id = $1 OR teacher_id = $2 OR room_id = $3)
                AND day = $4
                AND (
                    (start_time <= $5 AND end_time > $5)
                    OR (start_time < $6 AND end_time >= $6)
                    OR (start_time >= $5 AND end_time <= $6)
                )
             )`,
            [class_id, teacher_id, room_id, day, start_time, end_time]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({
                message: 'Timetable slot conflicts with existing schedule',
                conflicts
            });
        }

        const [slot] = await pool.query(
            `INSERT INTO timetable (
                class_id, subject_id, teacher_id, room_id,
                day, start_time, end_time, period_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [class_id, subject_id, teacher_id, room_id,
             day, start_time, end_time, period_number]
        );

        res.status(201).json(slot);
    } catch (error) {
        console.error('Error creating timetable slot:', error);
        res.status(500).json({ message: 'Server error while creating timetable slot' });
    }
};

// Update timetable slot
const updateTimetableSlot = async (req, res) => {
    try {
        const { slot_id } = req.params;
        const {
            subject_id,
            teacher_id,
            room_id,
            day,
            start_time,
            end_time,
            period_number
        } = req.body;

        // Check for conflicts excluding current slot
        const [conflicts] = await pool.query(
            `SELECT * FROM timetable 
             WHERE id != $1
             AND (
                (class_id = (SELECT class_id FROM timetable WHERE id = $1) OR teacher_id = $2 OR room_id = $3)
                AND day = $4
                AND (
                    (start_time <= $5 AND end_time > $5)
                    OR (start_time < $6 AND end_time >= $6)
                    OR (start_time >= $5 AND end_time <= $6)
                )
             )`,
            [slot_id, teacher_id, room_id, day, start_time, end_time]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({
                message: 'Timetable slot conflicts with existing schedule',
                conflicts
            });
        }

        const [slot] = await pool.query(
            `UPDATE timetable 
             SET subject_id = $1,
                 teacher_id = $2,
                 room_id = $3,
                 day = $4,
                 start_time = $5,
                 end_time = $6,
                 period_number = $7,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8
             RETURNING *`,
            [subject_id, teacher_id, room_id, day,
             start_time, end_time, period_number, slot_id]
        );

        if (!slot.length) {
            return res.status(404).json({ message: 'Timetable slot not found' });
        }

        res.json(slot[0]);
    } catch (error) {
        console.error('Error updating timetable slot:', error);
        res.status(500).json({ message: 'Server error while updating timetable slot' });
    }
};

// Delete timetable slot
const deleteTimetableSlot = async (req, res) => {
    try {
        const { slot_id } = req.params;

        const [slot] = await pool.query(
            'DELETE FROM timetable WHERE id = $1 RETURNING *',
            [slot_id]
        );

        if (!slot.length) {
            return res.status(404).json({ message: 'Timetable slot not found' });
        }

        res.json({ message: 'Timetable slot deleted successfully' });
    } catch (error) {
        console.error('Error deleting timetable slot:', error);
        res.status(500).json({ message: 'Server error while deleting timetable slot' });
    }
};

// Get teacher timetable
const getTeacherTimetable = async (req, res) => {
    try {
        const { teacher_id } = req.params;
        const { day } = req.query;

        let query = `
            SELECT 
                t.*,
                s.name as subject_name,
                s.code as subject_code,
                c.name as class_name,
                c.section,
                r.room_number
            FROM timetable t
            JOIN subjects s ON t.subject_id = s.id
            JOIN classes c ON t.class_id = c.id
            JOIN rooms r ON t.room_id = r.id
            WHERE t.teacher_id = $1
        `;
        const params = [teacher_id];

        if (day) {
            query += ` AND t.day = $${params.length + 1}`;
            params.push(day);
        }

        query += ` ORDER BY t.day, t.start_time`;

        const [timetable] = await pool.query(query, params);
        res.json(timetable);
    } catch (error) {
        console.error('Error fetching teacher timetable:', error);
        res.status(500).json({ message: 'Server error while fetching teacher timetable' });
    }
};

// Get room timetable
const getRoomTimetable = async (req, res) => {
    try {
        const { room_id } = req.params;
        const { day } = req.query;

        let query = `
            SELECT 
                t.*,
                s.name as subject_name,
                s.code as subject_code,
                c.name as class_name,
                c.section,
                te.name as teacher_name
            FROM timetable t
            JOIN subjects s ON t.subject_id = s.id
            JOIN classes c ON t.class_id = c.id
            JOIN teachers te ON t.teacher_id = te.id
            WHERE t.room_id = $1
        `;
        const params = [room_id];

        if (day) {
            query += ` AND t.day = $${params.length + 1}`;
            params.push(day);
        }

        query += ` ORDER BY t.day, t.start_time`;

        const [timetable] = await pool.query(query, params);
        res.json(timetable);
    } catch (error) {
        console.error('Error fetching room timetable:', error);
        res.status(500).json({ message: 'Server error while fetching room timetable' });
    }
};

// Get timetable statistics
const getTimetableStats = async (req, res) => {
    try {
        const [stats] = await pool.query(
            `SELECT 
                COUNT(DISTINCT class_id) as total_classes,
                COUNT(DISTINCT teacher_id) as total_teachers,
                COUNT(DISTINCT room_id) as total_rooms,
                COUNT(DISTINCT subject_id) as total_subjects,
                COUNT(*) as total_slots,
                COUNT(DISTINCT CASE WHEN day = 'Monday' THEN id END) as monday_slots,
                COUNT(DISTINCT CASE WHEN day = 'Tuesday' THEN id END) as tuesday_slots,
                COUNT(DISTINCT CASE WHEN day = 'Wednesday' THEN id END) as wednesday_slots,
                COUNT(DISTINCT CASE WHEN day = 'Thursday' THEN id END) as thursday_slots,
                COUNT(DISTINCT CASE WHEN day = 'Friday' THEN id END) as friday_slots
             FROM timetable`
        );

        // Get subject-wise distribution
        const [subjectStats] = await pool.query(
            `SELECT 
                s.name as subject_name,
                COUNT(t.id) as total_slots,
                COUNT(DISTINCT t.class_id) as total_classes,
                COUNT(DISTINCT t.teacher_id) as total_teachers
             FROM subjects s
             LEFT JOIN timetable t ON s.id = t.subject_id
             GROUP BY s.id, s.name
             ORDER BY total_slots DESC`
        );

        res.json({
            overall_stats: stats[0],
            subject_stats: subjectStats
        });
    } catch (error) {
        console.error('Error fetching timetable statistics:', error);
        res.status(500).json({ message: 'Server error while fetching timetable statistics' });
    }
};

module.exports = {
    getClassTimetable,
    createTimetableSlot,
    updateTimetableSlot,
    deleteTimetableSlot,
    getTeacherTimetable,
    getRoomTimetable,
    getTimetableStats
}; 
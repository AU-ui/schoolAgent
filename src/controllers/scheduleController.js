const pool = require('../config/db');

// Create a new schedule
const createSchedule = async (req, res) => {
    try {
        const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number } = req.body;

        // Check for schedule conflicts
        const conflictCheck = await pool.query(
            `SELECT * FROM schedules 
             WHERE (day_of_week = $1 AND room_number = $2 AND 
                    ((start_time <= $3 AND end_time > $3) OR 
                     (start_time < $4 AND end_time >= $4) OR 
                     (start_time >= $3 AND end_time <= $4)))
             OR (day_of_week = $1 AND teacher_id = $5 AND 
                 ((start_time <= $3 AND end_time > $3) OR 
                  (start_time < $4 AND end_time >= $4) OR 
                  (start_time >= $3 AND end_time <= $4)))`,
            [day_of_week, room_number, start_time, end_time, teacher_id]
        );

        if (conflictCheck.rows.length > 0) {
            return res.status(400).json({ 
                message: 'Schedule conflict detected with existing schedule' 
            });
        }

        const newSchedule = await pool.query(
            `INSERT INTO schedules (class_id, subject_id, teacher_id, day_of_week, 
                                  start_time, end_time, room_number, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number]
        );

        res.status(201).json(newSchedule.rows[0]);
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({ message: 'Server error while creating schedule' });
    }
};

// Get class schedule
const getClassSchedule = async (req, res) => {
    try {
        const { class_id } = req.params;

        const schedule = await pool.query(
            `SELECT s.*, sub.name as subject_name, u.name as teacher_name 
             FROM schedules s 
             JOIN subjects sub ON s.subject_id = sub.id 
             JOIN users u ON s.teacher_id = u.id 
             WHERE s.class_id = $1 
             ORDER BY s.day_of_week, s.start_time`,
            [class_id]
        );

        res.json(schedule.rows);
    } catch (error) {
        console.error('Error fetching class schedule:', error);
        res.status(500).json({ message: 'Server error while fetching schedule' });
    }
};

// Get teacher schedule
const getTeacherSchedule = async (req, res) => {
    try {
        const { teacher_id } = req.params;

        const schedule = await pool.query(
            `SELECT s.*, sub.name as subject_name, c.name as class_name 
             FROM schedules s 
             JOIN subjects sub ON s.subject_id = sub.id 
             JOIN classes c ON s.class_id = c.id 
             WHERE s.teacher_id = $1 
             ORDER BY s.day_of_week, s.start_time`,
            [teacher_id]
        );

        res.json(schedule.rows);
    } catch (error) {
        console.error('Error fetching teacher schedule:', error);
        res.status(500).json({ message: 'Server error while fetching schedule' });
    }
};

// Get student schedule
const getStudentSchedule = async (req, res) => {
    try {
        const { student_id } = req.params;

        const schedule = await pool.query(
            `SELECT s.*, sub.name as subject_name, u.name as teacher_name, c.name as class_name 
             FROM schedules s 
             JOIN subjects sub ON s.subject_id = sub.id 
             JOIN users u ON s.teacher_id = u.id 
             JOIN classes c ON s.class_id = c.id 
             JOIN student_classes sc ON c.id = sc.class_id 
             WHERE sc.student_id = $1 
             ORDER BY s.day_of_week, s.start_time`,
            [student_id]
        );

        res.json(schedule.rows);
    } catch (error) {
        console.error('Error fetching student schedule:', error);
        res.status(500).json({ message: 'Server error while fetching schedule' });
    }
};

// Update schedule
const updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { day_of_week, start_time, end_time, room_number, teacher_id } = req.body;

        // Check for schedule conflicts excluding current schedule
        const conflictCheck = await pool.query(
            `SELECT * FROM schedules 
             WHERE id != $1 AND 
                   ((day_of_week = $2 AND room_number = $3 AND 
                     ((start_time <= $4 AND end_time > $4) OR 
                      (start_time < $5 AND end_time >= $5) OR 
                      (start_time >= $4 AND end_time <= $5)))
                OR (day_of_week = $2 AND teacher_id = $6 AND 
                    ((start_time <= $4 AND end_time > $4) OR 
                     (start_time < $5 AND end_time >= $5) OR 
                     (start_time >= $4 AND end_time <= $5))))`,
            [id, day_of_week, room_number, start_time, end_time, teacher_id]
        );

        if (conflictCheck.rows.length > 0) {
            return res.status(400).json({ 
                message: 'Schedule conflict detected with existing schedule' 
            });
        }

        const updatedSchedule = await pool.query(
            `UPDATE schedules 
             SET day_of_week = $1, start_time = $2, end_time = $3, 
                 room_number = $4, teacher_id = $5, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $6 
             RETURNING *`,
            [day_of_week, start_time, end_time, room_number, teacher_id, id]
        );

        if (updatedSchedule.rows.length === 0) {
            return res.status(404).json({ message: 'Schedule not found' });
        }

        res.json(updatedSchedule.rows[0]);
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ message: 'Server error while updating schedule' });
    }
};

// Delete schedule
const deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedSchedule = await pool.query(
            'DELETE FROM schedules WHERE id = $1 RETURNING *',
            [id]
        );

        if (deletedSchedule.rows.length === 0) {
            return res.status(404).json({ message: 'Schedule not found' });
        }

        res.json({ message: 'Schedule deleted successfully' });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ message: 'Server error while deleting schedule' });
    }
};

// Get room schedule
const getRoomSchedule = async (req, res) => {
    try {
        const { room_number } = req.params;

        const schedule = await pool.query(
            `SELECT s.*, sub.name as subject_name, u.name as teacher_name, c.name as class_name 
             FROM schedules s 
             JOIN subjects sub ON s.subject_id = sub.id 
             JOIN users u ON s.teacher_id = u.id 
             JOIN classes c ON s.class_id = c.id 
             WHERE s.room_number = $1 
             ORDER BY s.day_of_week, s.start_time`,
            [room_number]
        );

        res.json(schedule.rows);
    } catch (error) {
        console.error('Error fetching room schedule:', error);
        res.status(500).json({ message: 'Server error while fetching schedule' });
    }
};

// Check schedule conflicts
const checkScheduleConflicts = async (req, res) => {
    try {
        const { day_of_week, start_time, end_time, room_number, teacher_id } = req.body;

        const conflicts = await pool.query(
            `SELECT s.*, sub.name as subject_name, u.name as teacher_name, c.name as class_name 
             FROM schedules s 
             JOIN subjects sub ON s.subject_id = sub.id 
             JOIN users u ON s.teacher_id = u.id 
             JOIN classes c ON s.class_id = c.id 
             WHERE (s.day_of_week = $1 AND s.room_number = $2 AND 
                    ((s.start_time <= $3 AND s.end_time > $3) OR 
                     (s.start_time < $4 AND s.end_time >= $4) OR 
                     (s.start_time >= $3 AND s.end_time <= $4)))
             OR (s.day_of_week = $1 AND s.teacher_id = $5 AND 
                 ((s.start_time <= $3 AND s.end_time > $3) OR 
                  (s.start_time < $4 AND s.end_time >= $4) OR 
                  (s.start_time >= $3 AND s.end_time <= $4)))`,
            [day_of_week, room_number, start_time, end_time, teacher_id]
        );

        res.json(conflicts.rows);
    } catch (error) {
        console.error('Error checking schedule conflicts:', error);
        res.status(500).json({ message: 'Server error while checking conflicts' });
    }
};

module.exports = {
    createSchedule,
    getClassSchedule,
    getTeacherSchedule,
    getStudentSchedule,
    updateSchedule,
    deleteSchedule,
    getRoomSchedule,
    checkScheduleConflicts
}; 
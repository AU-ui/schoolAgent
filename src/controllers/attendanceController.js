const pool = require('../config/db');

// Mark attendance for multiple students
const markAttendance = async (req, res) => {
    try {
        const { class_id, date, attendance_records } = req.body;

        // Start a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insert attendance records
            for (const record of attendance_records) {
                await client.query(
                    `INSERT INTO attendance (student_id, class_id, date, status, 
                                          remarks, marked_by, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
                    [record.student_id, class_id, date, record.status, 
                     record.remarks, req.user.id]
                );

                // Create notification for absent students
                if (record.status === 'absent') {
                    await client.query(
                        `INSERT INTO notifications (user_id, type, title, message, 
                                                 reference_id, created_at)
                         VALUES ($1, 'attendance', 'Absence Recorded', 
                                'Student was absent on ' || $2, $3, CURRENT_TIMESTAMP)`,
                        [record.student_id, date, class_id]
                    );
                }
            }

            await client.query('COMMIT');
            res.status(201).json({ message: 'Attendance marked successfully' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error marking attendance:', error);
        res.status(500).json({ message: 'Server error while marking attendance' });
    }
};

// Get attendance records for a class
const getClassAttendance = async (req, res) => {
    try {
        const { class_id, start_date, end_date } = req.query;

        const attendance = await pool.query(
            `SELECT a.*, 
                    s.name as student_name,
                    u.name as marked_by_name
             FROM attendance a
             JOIN students s ON a.student_id = s.id
             JOIN users u ON a.marked_by = u.id
             WHERE a.class_id = $1 
             AND a.date BETWEEN $2 AND $3
             ORDER BY a.date DESC, s.name ASC`,
            [class_id, start_date, end_date]
        );

        res.json(attendance.rows);
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ message: 'Server error while fetching attendance' });
    }
};

// Get student's attendance record
const getStudentAttendance = async (req, res) => {
    try {
        const { student_id, start_date, end_date } = req.query;

        const attendance = await pool.query(
            `SELECT a.*, 
                    c.name as class_name,
                    u.name as marked_by_name
             FROM attendance a
             JOIN classes c ON a.class_id = c.id
             JOIN users u ON a.marked_by = u.id
             WHERE a.student_id = $1 
             AND a.date BETWEEN $2 AND $3
             ORDER BY a.date DESC`,
            [student_id, start_date, end_date]
        );

        res.json(attendance.rows);
    } catch (error) {
        console.error('Error fetching student attendance:', error);
        res.status(500).json({ message: 'Server error while fetching attendance' });
    }
};

// Update attendance record
const updateAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        const updatedAttendance = await pool.query(
            `UPDATE attendance 
             SET status = $1, 
                 remarks = $2,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3 
             RETURNING *`,
            [status, remarks, id]
        );

        if (updatedAttendance.rows.length === 0) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        // Create notification for status change
        if (status === 'absent') {
            await pool.query(
                `INSERT INTO notifications (user_id, type, title, message, 
                                         reference_id, created_at)
                 VALUES ($1, 'attendance', 'Absence Updated', 
                        'Attendance status updated to absent', $2, CURRENT_TIMESTAMP)`,
                [updatedAttendance.rows[0].student_id, id]
            );
        }

        res.json(updatedAttendance.rows[0]);
    } catch (error) {
        console.error('Error updating attendance:', error);
        res.status(500).json({ message: 'Server error while updating attendance' });
    }
};

// Get attendance statistics
const getAttendanceStats = async (req, res) => {
    try {
        const { class_id, start_date, end_date } = req.query;

        const stats = await pool.query(
            `SELECT 
                s.id as student_id,
                s.name as student_name,
                COUNT(*) as total_days,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
                COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
                COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days
             FROM students s
             LEFT JOIN attendance a ON s.id = a.student_id 
             AND a.class_id = $1 
             AND a.date BETWEEN $2 AND $3
             WHERE s.class_id = $1
             GROUP BY s.id, s.name
             ORDER BY s.name`,
            [class_id, start_date, end_date]
        );

        res.json(stats.rows);
    } catch (error) {
        console.error('Error fetching attendance stats:', error);
        res.status(500).json({ message: 'Server error while fetching attendance stats' });
    }
};

// Get attendance exceptions (late/absent with remarks)
const getAttendanceExceptions = async (req, res) => {
    try {
        const { class_id, start_date, end_date } = req.query;

        const exceptions = await pool.query(
            `SELECT a.*, 
                    s.name as student_name,
                    u.name as marked_by_name
             FROM attendance a
             JOIN students s ON a.student_id = s.id
             JOIN users u ON a.marked_by = u.id
             WHERE a.class_id = $1 
             AND a.date BETWEEN $2 AND $3
             AND (a.status != 'present' OR a.remarks IS NOT NULL)
             ORDER BY a.date DESC, s.name ASC`,
            [class_id, start_date, end_date]
        );

        res.json(exceptions.rows);
    } catch (error) {
        console.error('Error fetching attendance exceptions:', error);
        res.status(500).json({ message: 'Server error while fetching exceptions' });
    }
};

// Get attendance summary for a student
const getStudentAttendanceSummary = async (req, res) => {
    try {
        const { student_id, start_date, end_date } = req.query;

        const summary = await pool.query(
            `SELECT 
                COUNT(*) as total_days,
                COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
                COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
                COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
                ROUND(COUNT(CASE WHEN status = 'present' THEN 1 END)::numeric / 
                      NULLIF(COUNT(*), 0) * 100, 2) as attendance_percentage
             FROM attendance
             WHERE student_id = $1 
             AND date BETWEEN $2 AND $3`,
            [student_id, start_date, end_date]
        );

        res.json(summary.rows[0]);
    } catch (error) {
        console.error('Error fetching attendance summary:', error);
        res.status(500).json({ message: 'Server error while fetching summary' });
    }
};

module.exports = {
    markAttendance,
    getClassAttendance,
    getStudentAttendance,
    updateAttendance,
    getAttendanceStats,
    getAttendanceExceptions,
    getStudentAttendanceSummary
}; 
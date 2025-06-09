const pool = require('../config/db');

// Get student profile
const getStudentProfile = async (req, res) => {
    try {
        const studentId = req.user.id;

        const student = await pool.query(
            `SELECT s.*, c.name as class_name, p.name as parent_name 
             FROM students s 
             JOIN classes c ON s.class_id = c.id 
             JOIN users p ON s.parent_id = p.id 
             WHERE s.id = $1`,
            [studentId]
        );

        if (student.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json(student.rows[0]);
    } catch (error) {
        console.error('Error fetching student profile:', error);
        res.status(500).json({ message: 'Server error while fetching profile' });
    }
};

// Get student's classes
const getStudentClasses = async (req, res) => {
    try {
        const studentId = req.user.id;

        const classes = await pool.query(
            `SELECT c.*, t.name as teacher_name 
             FROM student_classes sc 
             JOIN classes c ON sc.class_id = c.id 
             JOIN users t ON c.teacher_id = t.id 
             WHERE sc.student_id = $1`,
            [studentId]
        );

        res.json(classes.rows);
    } catch (error) {
        console.error('Error fetching student classes:', error);
        res.status(500).json({ message: 'Server error while fetching classes' });
    }
};

// Get student's grades
const getStudentGrades = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { classId } = req.params;

        const grades = await pool.query(
            `SELECT g.*, s.name as subject_name 
             FROM grades g 
             JOIN subjects s ON g.subject_id = s.id 
             WHERE g.student_id = $1 AND g.class_id = $2 
             ORDER BY g.date DESC`,
            [studentId, classId]
        );

        res.json(grades.rows);
    } catch (error) {
        console.error('Error fetching student grades:', error);
        res.status(500).json({ message: 'Server error while fetching grades' });
    }
};

// Get student's attendance
const getStudentAttendance = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { startDate, endDate } = req.query;

        const attendance = await pool.query(
            `SELECT a.*, c.name as class_name 
             FROM attendance a 
             JOIN classes c ON a.class_id = c.id 
             WHERE a.student_id = $1 
             AND a.date BETWEEN $2 AND $3 
             ORDER BY a.date DESC`,
            [studentId, startDate, endDate]
        );

        res.json(attendance.rows);
    } catch (error) {
        console.error('Error fetching student attendance:', error);
        res.status(500).json({ message: 'Server error while fetching attendance' });
    }
};

// Update student profile
const updateStudentProfile = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { phone, address } = req.body;

        const updatedStudent = await pool.query(
            'UPDATE students SET phone = $1, address = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [phone, address, studentId]
        );

        if (updatedStudent.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json(updatedStudent.rows[0]);
    } catch (error) {
        console.error('Error updating student profile:', error);
        res.status(500).json({ message: 'Server error while updating profile' });
    }
};

module.exports = {
    getStudentProfile,
    getStudentClasses,
    getStudentGrades,
    getStudentAttendance,
    updateStudentProfile
}; 
const pool = require('../config/db');

// Create a new class
const createClass = async (req, res) => {
    try {
        const { name, description, teacher_id, capacity, schedule } = req.body;

        const newClass = await pool.query(
            `INSERT INTO classes (name, description, teacher_id, capacity, schedule, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [name, description, teacher_id, capacity, schedule]
        );

        res.status(201).json(newClass.rows[0]);
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).json({ message: 'Server error while creating class' });
    }
};

// Get all classes
const getAllClasses = async (req, res) => {
    try {
        const classes = await pool.query(
            `SELECT c.*, u.name as teacher_name, 
             (SELECT COUNT(*) FROM student_classes WHERE class_id = c.id) as enrolled_students 
             FROM classes c 
             LEFT JOIN users u ON c.teacher_id = u.id 
             ORDER BY c.name`
        );

        res.json(classes.rows);
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ message: 'Server error while fetching classes' });
    }
};

// Get class by ID
const getClassById = async (req, res) => {
    try {
        const { id } = req.params;

        const classData = await pool.query(
            `SELECT c.*, u.name as teacher_name 
             FROM classes c 
             LEFT JOIN users u ON c.teacher_id = u.id 
             WHERE c.id = $1`,
            [id]
        );

        if (classData.rows.length === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }

        res.json(classData.rows[0]);
    } catch (error) {
        console.error('Error fetching class:', error);
        res.status(500).json({ message: 'Server error while fetching class' });
    }
};

// Update class
const updateClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, teacher_id, capacity, schedule } = req.body;

        const updatedClass = await pool.query(
            `UPDATE classes 
             SET name = $1, description = $2, teacher_id = $3, 
                 capacity = $4, schedule = $5, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $6 
             RETURNING *`,
            [name, description, teacher_id, capacity, schedule, id]
        );

        if (updatedClass.rows.length === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }

        res.json(updatedClass.rows[0]);
    } catch (error) {
        console.error('Error updating class:', error);
        res.status(500).json({ message: 'Server error while updating class' });
    }
};

// Delete class
const deleteClass = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedClass = await pool.query(
            'DELETE FROM classes WHERE id = $1 RETURNING *',
            [id]
        );

        if (deletedClass.rows.length === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }

        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        console.error('Error deleting class:', error);
        res.status(500).json({ message: 'Server error while deleting class' });
    }
};

// Enroll student in class
const enrollStudent = async (req, res) => {
    try {
        const { classId, studentId } = req.body;

        // Check if class is full
        const classInfo = await pool.query(
            `SELECT c.capacity, 
             (SELECT COUNT(*) FROM student_classes WHERE class_id = c.id) as current_enrollment 
             FROM classes c WHERE c.id = $1`,
            [classId]
        );

        if (classInfo.rows[0].current_enrollment >= classInfo.rows[0].capacity) {
            return res.status(400).json({ message: 'Class is full' });
        }

        // Check if student is already enrolled
        const existingEnrollment = await pool.query(
            'SELECT * FROM student_classes WHERE class_id = $1 AND student_id = $2',
            [classId, studentId]
        );

        if (existingEnrollment.rows.length > 0) {
            return res.status(400).json({ message: 'Student is already enrolled in this class' });
        }

        const enrollment = await pool.query(
            `INSERT INTO student_classes (class_id, student_id, enrolled_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [classId, studentId]
        );

        res.status(201).json(enrollment.rows[0]);
    } catch (error) {
        console.error('Error enrolling student:', error);
        res.status(500).json({ message: 'Server error while enrolling student' });
    }
};

// Get class roster
const getClassRoster = async (req, res) => {
    try {
        const { classId } = req.params;

        const roster = await pool.query(
            `SELECT s.*, u.name as student_name 
             FROM student_classes sc 
             JOIN students s ON sc.student_id = s.id 
             JOIN users u ON s.id = u.id 
             WHERE sc.class_id = $1 
             ORDER BY u.name`,
            [classId]
        );

        res.json(roster.rows);
    } catch (error) {
        console.error('Error fetching class roster:', error);
        res.status(500).json({ message: 'Server error while fetching class roster' });
    }
};

// Create class announcement
const createAnnouncement = async (req, res) => {
    try {
        const { classId } = req.params;
        const { title, content } = req.body;
        const teacherId = req.user.id;

        const announcement = await pool.query(
            `INSERT INTO class_announcements (class_id, teacher_id, title, content, created_at) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [classId, teacherId, title, content]
        );

        res.status(201).json(announcement.rows[0]);
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ message: 'Server error while creating announcement' });
    }
};

// Get class announcements
const getAnnouncements = async (req, res) => {
    try {
        const { classId } = req.params;

        const announcements = await pool.query(
            `SELECT ca.*, u.name as teacher_name 
             FROM class_announcements ca 
             JOIN users u ON ca.teacher_id = u.id 
             WHERE ca.class_id = $1 
             ORDER BY ca.created_at DESC`,
            [classId]
        );

        res.json(announcements.rows);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ message: 'Server error while fetching announcements' });
    }
};

module.exports = {
    createClass,
    getAllClasses,
    getClassById,
    updateClass,
    deleteClass,
    enrollStudent,
    getClassRoster,
    createAnnouncement,
    getAnnouncements
}; 
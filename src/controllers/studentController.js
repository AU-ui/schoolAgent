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

// Get student performance statistics
const getStudentPerformanceStats = async (req, res) => {
    try {
        const { student_id } = req.params;
        const { class_id, subject_id, exam_type, term } = req.query;

        // Get overall performance
        const [overallStats] = await pool.query(
            `SELECT 
                COUNT(DISTINCT e.id) as total_exams,
                ROUND(AVG(er.marks_obtained), 2) as average_marks,
                MAX(er.marks_obtained) as highest_marks,
                MIN(er.marks_obtained) as lowest_marks,
                COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END) as exams_passed,
                COUNT(CASE WHEN er.marks_obtained < e.passing_marks THEN 1 END) as exams_failed,
                ROUND((COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END)::float / 
                    COUNT(DISTINCT e.id)::float) * 100, 2) as pass_percentage
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.id
            WHERE er.student_id = $1
            ${class_id ? 'AND e.class_id = $2' : ''}
            ${subject_id ? 'AND e.subject_id = $3' : ''}
            ${exam_type ? 'AND e.exam_type = $4' : ''}
            ${term ? 'AND e.term = $5' : ''}`,
            [student_id, class_id, subject_id, exam_type, term].filter(Boolean)
        );

        // Get subject-wise performance
        const [subjectStats] = await pool.query(
            `SELECT 
                s.name as subject_name,
                COUNT(DISTINCT e.id) as total_exams,
                ROUND(AVG(er.marks_obtained), 2) as average_marks,
                MAX(er.marks_obtained) as highest_marks,
                MIN(er.marks_obtained) as lowest_marks,
                COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END) as exams_passed,
                COUNT(CASE WHEN er.marks_obtained < e.passing_marks THEN 1 END) as exams_failed
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.id
            JOIN subjects s ON e.subject_id = s.id
            WHERE er.student_id = $1
            ${class_id ? 'AND e.class_id = $2' : ''}
            ${exam_type ? 'AND e.exam_type = $3' : ''}
            ${term ? 'AND e.term = $4' : ''}
            GROUP BY s.id, s.name
            ORDER BY s.name`,
            [student_id, class_id, exam_type, term].filter(Boolean)
        );

        // Get exam type performance
        const [examTypeStats] = await pool.query(
            `SELECT 
                e.exam_type,
                COUNT(DISTINCT e.id) as total_exams,
                ROUND(AVG(er.marks_obtained), 2) as average_marks,
                MAX(er.marks_obtained) as highest_marks,
                MIN(er.marks_obtained) as lowest_marks,
                COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END) as exams_passed,
                COUNT(CASE WHEN er.marks_obtained < e.passing_marks THEN 1 END) as exams_failed
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.id
            WHERE er.student_id = $1
            ${class_id ? 'AND e.class_id = $2' : ''}
            ${subject_id ? 'AND e.subject_id = $3' : ''}
            ${term ? 'AND e.term = $4' : ''}
            GROUP BY e.exam_type
            ORDER BY e.exam_type`,
            [student_id, class_id, subject_id, term].filter(Boolean)
        );

        // Get performance trend
        const [performanceTrend] = await pool.query(
            `SELECT 
                e.exam_type,
                e.start_date,
                er.marks_obtained,
                e.total_marks,
                ROUND((er.marks_obtained::float / e.total_marks::float) * 100, 2) as percentage,
                CASE 
                    WHEN er.marks_obtained >= e.passing_marks THEN 'Pass'
                    ELSE 'Fail'
                END as result
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.id
            WHERE er.student_id = $1
            ${class_id ? 'AND e.class_id = $2' : ''}
            ${subject_id ? 'AND e.subject_id = $3' : ''}
            ${exam_type ? 'AND e.exam_type = $4' : ''}
            ${term ? 'AND e.term = $5' : ''}
            ORDER BY e.start_date ASC`,
            [student_id, class_id, subject_id, exam_type, term].filter(Boolean)
        );

        // Get strength and weakness analysis
        const [strengthWeakness] = await pool.query(
            `WITH question_stats AS (
                SELECT 
                    eq.question_type,
                    eq.difficulty_level,
                    eq.skill_type,
                    COUNT(*) as total_questions,
                    COUNT(CASE WHEN eqr.is_correct THEN 1 END) as correct_answers
                FROM exam_question_results eqr
                JOIN exam_questions eq ON eqr.question_id = eq.id
                JOIN exam_results er ON eqr.exam_result_id = er.id
                WHERE er.student_id = $1
                ${class_id ? 'AND er.class_id = $2' : ''}
                ${subject_id ? 'AND er.subject_id = $3' : ''}
                GROUP BY eq.question_type, eq.difficulty_level, eq.skill_type
            )
            SELECT 
                question_type,
                difficulty_level,
                skill_type,
                total_questions,
                correct_answers,
                ROUND((correct_answers::float / total_questions::float) * 100, 2) as success_rate,
                CASE 
                    WHEN (correct_answers::float / total_questions::float) >= 0.7 THEN 'Strength'
                    WHEN (correct_answers::float / total_questions::float) <= 0.4 THEN 'Weakness'
                    ELSE 'Needs Improvement'
                END as performance_category
            FROM question_stats
            ORDER BY success_rate DESC`,
            [student_id, class_id, subject_id].filter(Boolean)
        );

        res.json({
            success: true,
            data: {
                overall_performance: overallStats[0],
                subject_wise_performance: subjectStats,
                exam_type_performance: examTypeStats,
                performance_trend: performanceTrend,
                strength_weakness_analysis: strengthWeakness
            }
        });

    } catch (error) {
        console.error('Error fetching student performance stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching student performance statistics',
            error: error.message
        });
    }
};

module.exports = {
    getStudentProfile,
    getStudentClasses,
    getStudentGrades,
    getStudentAttendance,
    updateStudentProfile,
    getStudentPerformanceStats
}; 
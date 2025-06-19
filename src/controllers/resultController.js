const pool = require('../config/db');

// Get exam results
const getExamResults = async (req, res) => {
    try {
        const { exam_id, class_id, student_id } = req.query;
        let query = `
            SELECT 
                r.*,
                s.name as student_name,
                s.admission_number,
                c.name as class_name,
                c.section,
                sub.name as subject_name,
                sub.code as subject_code,
                e.name as exam_name,
                e.exam_date,
                e.total_marks
            FROM results r
            JOIN students s ON r.student_id = s.id
            JOIN classes c ON s.class_id = c.id
            JOIN subjects sub ON r.subject_id = sub.id
            JOIN exams e ON r.exam_id = e.id
            WHERE 1=1
        `;
        const params = [];

        if (exam_id) {
            query += ` AND r.exam_id = $${params.length + 1}`;
            params.push(exam_id);
        }

        if (class_id) {
            query += ` AND s.class_id = $${params.length + 1}`;
            params.push(class_id);
        }

        if (student_id) {
            query += ` AND r.student_id = $${params.length + 1}`;
            params.push(student_id);
        }

        query += ` ORDER BY s.name, sub.name`;

        const [results] = await pool.query(query, params);
        res.json(results);
    } catch (error) {
        console.error('Error fetching exam results:', error);
        res.status(500).json({ message: 'Server error while fetching exam results' });
    }
};

// Add exam result
const addExamResult = async (req, res) => {
    try {
        const {
            exam_id,
            student_id,
            subject_id,
            marks_obtained,
            grade,
            remarks
        } = req.body;

        // Check if result already exists
        const [existing] = await pool.query(
            `SELECT * FROM results 
             WHERE exam_id = $1 AND student_id = $2 AND subject_id = $3`,
            [exam_id, student_id, subject_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Result already exists for this exam, subject, and student' });
        }

        const [result] = await pool.query(
            `INSERT INTO results (
                exam_id, student_id, subject_id,
                marks_obtained, grade, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [exam_id, student_id, subject_id, marks_obtained, grade, remarks]
        );

        res.status(201).json(result);
    } catch (error) {
        console.error('Error adding exam result:', error);
        res.status(500).json({ message: 'Server error while adding exam result' });
    }
};

// Update exam result
const updateExamResult = async (req, res) => {
    try {
        const { result_id } = req.params;
        const { marks_obtained, grade, remarks } = req.body;

        const [result] = await pool.query(
            `UPDATE results 
             SET marks_obtained = $1,
                 grade = $2,
                 remarks = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [marks_obtained, grade, remarks, result_id]
        );

        if (!result.length) {
            return res.status(404).json({ message: 'Result not found' });
        }

        res.json(result[0]);
    } catch (error) {
        console.error('Error updating exam result:', error);
        res.status(500).json({ message: 'Server error while updating exam result' });
    }
};

// Get student performance
const getStudentPerformance = async (req, res) => {
    try {
        const { student_id } = req.params;
        const { subject_id, exam_type } = req.query;

        let query = `
            WITH student_ranks AS (
                SELECT 
                    r.*,
                    RANK() OVER (PARTITION BY r.exam_id, r.subject_id ORDER BY r.marks_obtained DESC) as subject_rank,
                    COUNT(*) OVER (PARTITION BY r.exam_id, r.subject_id) as total_students
                FROM results r
                JOIN exams e ON r.exam_id = e.id
                WHERE r.student_id = $1
            )
            SELECT 
                sr.*,
                s.name as subject_name,
                s.code as subject_code,
                e.name as exam_name,
                e.exam_date,
                e.total_marks,
                ROUND((sr.marks_obtained::float / e.total_marks) * 100, 2) as percentage,
                CASE 
                    WHEN sr.subject_rank = 1 THEN '1st'
                    WHEN sr.subject_rank = 2 THEN '2nd'
                    WHEN sr.subject_rank = 3 THEN '3rd'
                    ELSE sr.subject_rank || 'th'
                END as rank_position
            FROM student_ranks sr
            JOIN subjects s ON sr.subject_id = s.id
            JOIN exams e ON sr.exam_id = e.id
            WHERE 1=1
        `;
        const params = [student_id];

        if (subject_id) {
            query += ` AND sr.subject_id = $${params.length + 1}`;
            params.push(subject_id);
        }

        if (exam_type) {
            query += ` AND e.type = $${params.length + 1}`;
            params.push(exam_type);
        }

        query += ` ORDER BY e.exam_date DESC, s.name`;

        const [performance] = await pool.query(query, params);
        res.json(performance);
    } catch (error) {
        console.error('Error fetching student performance:', error);
        res.status(500).json({ message: 'Server error while fetching student performance' });
    }
};

// Get class performance
const getClassPerformance = async (req, res) => {
    try {
        const { class_id } = req.params;
        const { exam_id, subject_id } = req.query;

        let query = `
            WITH class_ranks AS (
                SELECT 
                    r.*,
                    RANK() OVER (PARTITION BY r.exam_id, r.subject_id ORDER BY r.marks_obtained DESC) as subject_rank,
                    COUNT(*) OVER (PARTITION BY r.exam_id, r.subject_id) as total_students
                FROM results r
                JOIN students s ON r.student_id = s.id
                WHERE s.class_id = $1
            )
            SELECT 
                cr.*,
                s.name as student_name,
                s.admission_number,
                sub.name as subject_name,
                sub.code as subject_code,
                e.name as exam_name,
                e.exam_date,
                e.total_marks,
                ROUND((cr.marks_obtained::float / e.total_marks) * 100, 2) as percentage,
                CASE 
                    WHEN cr.subject_rank = 1 THEN '1st'
                    WHEN cr.subject_rank = 2 THEN '2nd'
                    WHEN cr.subject_rank = 3 THEN '3rd'
                    ELSE cr.subject_rank || 'th'
                END as rank_position
            FROM class_ranks cr
            JOIN students s ON cr.student_id = s.id
            JOIN subjects sub ON cr.subject_id = sub.id
            JOIN exams e ON cr.exam_id = e.id
            WHERE 1=1
        `;
        const params = [class_id];

        if (exam_id) {
            query += ` AND cr.exam_id = $${params.length + 1}`;
            params.push(exam_id);
        }

        if (subject_id) {
            query += ` AND cr.subject_id = $${params.length + 1}`;
            params.push(subject_id);
        }

        query += ` ORDER BY sub.name, cr.subject_rank`;

        const [performance] = await pool.query(query, params);
        res.json(performance);
    } catch (error) {
        console.error('Error fetching class performance:', error);
        res.status(500).json({ message: 'Server error while fetching class performance' });
    }
};

// Get result statistics
const getResultStats = async (req, res) => {
    try {
        const { exam_id, class_id } = req.query;

        let query = `
            SELECT 
                COUNT(DISTINCT r.student_id) as total_students,
                COUNT(DISTINCT r.subject_id) as total_subjects,
                ROUND(AVG(r.marks_obtained::float / e.total_marks * 100), 2) as average_percentage,
                MIN(r.marks_obtained::float / e.total_marks * 100) as lowest_percentage,
                MAX(r.marks_obtained::float / e.total_marks * 100) as highest_percentage,
                COUNT(DISTINCT CASE WHEN r.grade = 'A' THEN r.id END) as grade_a_count,
                COUNT(DISTINCT CASE WHEN r.grade = 'B' THEN r.id END) as grade_b_count,
                COUNT(DISTINCT CASE WHEN r.grade = 'C' THEN r.id END) as grade_c_count,
                COUNT(DISTINCT CASE WHEN r.grade = 'D' THEN r.id END) as grade_d_count,
                COUNT(DISTINCT CASE WHEN r.grade = 'F' THEN r.id END) as grade_f_count
            FROM results r
            JOIN exams e ON r.exam_id = e.id
            JOIN students s ON r.student_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (exam_id) {
            query += ` AND r.exam_id = $${params.length + 1}`;
            params.push(exam_id);
        }

        if (class_id) {
            query += ` AND s.class_id = $${params.length + 1}`;
            params.push(class_id);
        }

        const [stats] = await pool.query(query, params);

        // Get subject-wise performance
        const [subjectStats] = await pool.query(
            `SELECT 
                s.name as subject_name,
                s.code as subject_code,
                COUNT(DISTINCT r.student_id) as total_students,
                ROUND(AVG(r.marks_obtained::float / e.total_marks * 100), 2) as average_percentage,
                MIN(r.marks_obtained::float / e.total_marks * 100) as lowest_percentage,
                MAX(r.marks_obtained::float / e.total_marks * 100) as highest_percentage,
                COUNT(DISTINCT CASE WHEN r.grade = 'A' THEN r.id END) as grade_a_count,
                COUNT(DISTINCT CASE WHEN r.grade = 'B' THEN r.id END) as grade_b_count,
                COUNT(DISTINCT CASE WHEN r.grade = 'C' THEN r.id END) as grade_c_count,
                COUNT(DISTINCT CASE WHEN r.grade = 'D' THEN r.id END) as grade_d_count,
                COUNT(DISTINCT CASE WHEN r.grade = 'F' THEN r.id END) as grade_f_count
             FROM results r
             JOIN exams e ON r.exam_id = e.id
             JOIN subjects s ON r.subject_id = s.id
             JOIN students st ON r.student_id = st.id
             WHERE 1=1
             ${exam_id ? 'AND r.exam_id = $1' : ''}
             ${class_id ? `AND st.class_id = $${exam_id ? '2' : '1'}` : ''}
             GROUP BY s.id, s.name, s.code
             ORDER BY s.name`,
            exam_id ? (class_id ? [exam_id, class_id] : [exam_id]) : (class_id ? [class_id] : [])
        );

        res.json({
            overall_stats: stats[0],
            subject_stats: subjectStats
        });
    } catch (error) {
        console.error('Error fetching result statistics:', error);
        res.status(500).json({ message: 'Server error while fetching result statistics' });
    }
};

module.exports = {
    getExamResults,
    addExamResult,
    updateExamResult,
    getStudentPerformance,
    getClassPerformance,
    getResultStats
}; 
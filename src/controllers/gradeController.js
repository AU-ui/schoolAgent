const pool = require('../config/db');

// Add a new grade
const addGrade = async (req, res) => {
    try {
        const { student_id, class_id, subject_id, grade, category, comments } = req.body;
        const teacher_id = req.user.id;

        const newGrade = await pool.query(
            `INSERT INTO grades (student_id, class_id, subject_id, teacher_id, grade, category, comments, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [student_id, class_id, subject_id, teacher_id, grade, category, comments]
        );

        res.status(201).json(newGrade.rows[0]);
    } catch (error) {
        console.error('Error adding grade:', error);
        res.status(500).json({ message: 'Server error while adding grade' });
    }
};

// Update a grade
const updateGrade = async (req, res) => {
    try {
        const { id } = req.params;
        const { grade, category, comments } = req.body;
        const teacher_id = req.user.id;

        const updatedGrade = await pool.query(
            `UPDATE grades 
             SET grade = $1, category = $2, comments = $3, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $4 AND teacher_id = $5 
             RETURNING *`,
            [grade, category, comments, id, teacher_id]
        );

        if (updatedGrade.rows.length === 0) {
            return res.status(404).json({ message: 'Grade not found or unauthorized' });
        }

        res.json(updatedGrade.rows[0]);
    } catch (error) {
        console.error('Error updating grade:', error);
        res.status(500).json({ message: 'Server error while updating grade' });
    }
};

// Get student's grades
const getStudentGrades = async (req, res) => {
    try {
        const { student_id, class_id } = req.params;

        const grades = await pool.query(
            `SELECT g.*, s.name as subject_name, c.name as category_name 
             FROM grades g 
             JOIN subjects s ON g.subject_id = s.id 
             JOIN grade_categories c ON g.category = c.id 
             WHERE g.student_id = $1 AND g.class_id = $2 
             ORDER BY g.created_at DESC`,
            [student_id, class_id]
        );

        res.json(grades.rows);
    } catch (error) {
        console.error('Error fetching student grades:', error);
        res.status(500).json({ message: 'Server error while fetching grades' });
    }
};

// Calculate class average
const getClassAverage = async (req, res) => {
    try {
        const { class_id, subject_id } = req.params;

        const averages = await pool.query(
            `SELECT 
                AVG(grade) as class_average,
                MIN(grade) as lowest_grade,
                MAX(grade) as highest_grade,
                COUNT(*) as total_grades
             FROM grades 
             WHERE class_id = $1 AND subject_id = $2`,
            [class_id, subject_id]
        );

        res.json(averages.rows[0]);
    } catch (error) {
        console.error('Error calculating class average:', error);
        res.status(500).json({ message: 'Server error while calculating averages' });
    }
};

// Get grade report
const getGradeReport = async (req, res) => {
    try {
        const { student_id, class_id } = req.params;

        const report = await pool.query(
            `SELECT 
                s.name as subject_name,
                c.name as category_name,
                AVG(g.grade) as average_grade,
                COUNT(*) as total_assignments
             FROM grades g 
             JOIN subjects s ON g.subject_id = s.id 
             JOIN grade_categories c ON g.category = c.id 
             WHERE g.student_id = $1 AND g.class_id = $2 
             GROUP BY s.name, c.name 
             ORDER BY s.name, c.name`,
            [student_id, class_id]
        );

        res.json(report.rows);
    } catch (error) {
        console.error('Error generating grade report:', error);
        res.status(500).json({ message: 'Server error while generating report' });
    }
};

// Get grade categories
const getGradeCategories = async (req, res) => {
    try {
        const categories = await pool.query(
            'SELECT * FROM grade_categories ORDER BY name'
        );

        res.json(categories.rows);
    } catch (error) {
        console.error('Error fetching grade categories:', error);
        res.status(500).json({ message: 'Server error while fetching categories' });
    }
};

// Add grade category
const addGradeCategory = async (req, res) => {
    try {
        const { name, weight } = req.body;

        const newCategory = await pool.query(
            `INSERT INTO grade_categories (name, weight, created_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [name, weight]
        );

        res.status(201).json(newCategory.rows[0]);
    } catch (error) {
        console.error('Error adding grade category:', error);
        res.status(500).json({ message: 'Server error while adding category' });
    }
};

// Get student's GPA
const getStudentGPA = async (req, res) => {
    try {
        const { student_id } = req.params;

        const gpa = await pool.query(
            `SELECT 
                AVG(g.grade) as gpa,
                COUNT(DISTINCT g.class_id) as total_classes
             FROM grades g 
             WHERE g.student_id = $1`,
            [student_id]
        );

        res.json(gpa.rows[0]);
    } catch (error) {
        console.error('Error calculating GPA:', error);
        res.status(500).json({ message: 'Server error while calculating GPA' });
    }
};

// Get grade distribution
const getGradeDistribution = async (req, res) => {
    try {
        const { class_id, subject_id } = req.params;

        const distribution = await pool.query(
            `SELECT 
                grade,
                COUNT(*) as count
             FROM grades 
             WHERE class_id = $1 AND subject_id = $2 
             GROUP BY grade 
             ORDER BY grade`,
            [class_id, subject_id]
        );

        res.json(distribution.rows);
    } catch (error) {
        console.error('Error getting grade distribution:', error);
        res.status(500).json({ message: 'Server error while getting distribution' });
    }
};

module.exports = {
    addGrade,
    updateGrade,
    getStudentGrades,
    getClassAverage,
    getGradeReport,
    getGradeCategories,
    addGradeCategory,
    getStudentGPA,
    getGradeDistribution
}; 
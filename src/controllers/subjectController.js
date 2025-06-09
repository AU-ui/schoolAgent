const pool = require('../config/db');

// Create a new subject
const createSubject = async (req, res) => {
    try {
        const { name, description, credits, department, prerequisites } = req.body;

        const newSubject = await pool.query(
            `INSERT INTO subjects (name, description, credits, department, prerequisites, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [name, description, credits, department, prerequisites]
        );

        res.status(201).json(newSubject.rows[0]);
    } catch (error) {
        console.error('Error creating subject:', error);
        res.status(500).json({ message: 'Server error while creating subject' });
    }
};

// Get all subjects
const getAllSubjects = async (req, res) => {
    try {
        const subjects = await pool.query(
            `SELECT s.*, 
             (SELECT COUNT(*) FROM class_subjects WHERE subject_id = s.id) as total_classes 
             FROM subjects s 
             ORDER BY s.name`
        );

        res.json(subjects.rows);
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({ message: 'Server error while fetching subjects' });
    }
};

// Get subject by ID
const getSubjectById = async (req, res) => {
    try {
        const { id } = req.params;

        const subject = await pool.query(
            `SELECT s.*, 
             (SELECT json_agg(c.*) 
              FROM classes c 
              JOIN class_subjects cs ON c.id = cs.class_id 
              WHERE cs.subject_id = s.id) as classes 
             FROM subjects s 
             WHERE s.id = $1`,
            [id]
        );

        if (subject.rows.length === 0) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        res.json(subject.rows[0]);
    } catch (error) {
        console.error('Error fetching subject:', error);
        res.status(500).json({ message: 'Server error while fetching subject' });
    }
};

// Update subject
const updateSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, credits, department, prerequisites } = req.body;

        const updatedSubject = await pool.query(
            `UPDATE subjects 
             SET name = $1, description = $2, credits = $3, 
                 department = $4, prerequisites = $5, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $6 
             RETURNING *`,
            [name, description, credits, department, prerequisites, id]
        );

        if (updatedSubject.rows.length === 0) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        res.json(updatedSubject.rows[0]);
    } catch (error) {
        console.error('Error updating subject:', error);
        res.status(500).json({ message: 'Server error while updating subject' });
    }
};

// Delete subject
const deleteSubject = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if subject is being used in any classes
        const subjectUsage = await pool.query(
            'SELECT COUNT(*) FROM class_subjects WHERE subject_id = $1',
            [id]
        );

        if (subjectUsage.rows[0].count > 0) {
            return res.status(400).json({ 
                message: 'Cannot delete subject as it is assigned to classes' 
            });
        }

        const deletedSubject = await pool.query(
            'DELETE FROM subjects WHERE id = $1 RETURNING *',
            [id]
        );

        if (deletedSubject.rows.length === 0) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        res.json({ message: 'Subject deleted successfully' });
    } catch (error) {
        console.error('Error deleting subject:', error);
        res.status(500).json({ message: 'Server error while deleting subject' });
    }
};

// Assign subject to class
const assignSubjectToClass = async (req, res) => {
    try {
        const { subject_id, class_id } = req.body;

        // Check if assignment already exists
        const existingAssignment = await pool.query(
            'SELECT * FROM class_subjects WHERE subject_id = $1 AND class_id = $2',
            [subject_id, class_id]
        );

        if (existingAssignment.rows.length > 0) {
            return res.status(400).json({ message: 'Subject already assigned to this class' });
        }

        const assignment = await pool.query(
            `INSERT INTO class_subjects (subject_id, class_id, assigned_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [subject_id, class_id]
        );

        res.status(201).json(assignment.rows[0]);
    } catch (error) {
        console.error('Error assigning subject:', error);
        res.status(500).json({ message: 'Server error while assigning subject' });
    }
};

// Get subjects by department
const getSubjectsByDepartment = async (req, res) => {
    try {
        const { department } = req.params;

        const subjects = await pool.query(
            `SELECT s.*, 
             (SELECT COUNT(*) FROM class_subjects WHERE subject_id = s.id) as total_classes 
             FROM subjects s 
             WHERE s.department = $1 
             ORDER BY s.name`,
            [department]
        );

        res.json(subjects.rows);
    } catch (error) {
        console.error('Error fetching subjects by department:', error);
        res.status(500).json({ message: 'Server error while fetching subjects' });
    }
};

// Get subject prerequisites
const getSubjectPrerequisites = async (req, res) => {
    try {
        const { id } = req.params;

        const prerequisites = await pool.query(
            `SELECT s.* 
             FROM subjects s 
             WHERE s.id IN (
                 SELECT unnest(prerequisites) 
                 FROM subjects 
                 WHERE id = $1
             )`,
            [id]
        );

        res.json(prerequisites.rows);
    } catch (error) {
        console.error('Error fetching prerequisites:', error);
        res.status(500).json({ message: 'Server error while fetching prerequisites' });
    }
};

module.exports = {
    createSubject,
    getAllSubjects,
    getSubjectById,
    updateSubject,
    deleteSubject,
    assignSubjectToClass,
    getSubjectsByDepartment,
    getSubjectPrerequisites
}; 
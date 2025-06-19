const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const docx = require('docx');
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

// Create a new exam
const createExam = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            exam_type, 
            start_date, 
            end_date, 
            class_id, 
            subject_id,
            total_marks,
            passing_marks,
            duration_minutes,
            room_id
        } = req.body;

        const newExam = await pool.query(
            `INSERT INTO exams (
                title, description, exam_type, start_date, end_date,
                class_id, subject_id, total_marks, passing_marks,
                duration_minutes, room_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
            RETURNING *`,
            [title, description, exam_type, start_date, end_date, class_id, 
             subject_id, total_marks, passing_marks, duration_minutes, room_id]
        );

        res.status(201).json(newExam.rows[0]);
    } catch (error) {
        console.error('Error creating exam:', error);
        res.status(500).json({ message: 'Server error while creating exam' });
    }
};

// Get all exams
const getAllExams = async (req, res) => {
    try {
        const { class_id, subject_id, exam_type, start_date, end_date } = req.query;

        let query = `
            SELECT e.*, 
                   c.name as class_name,
                   s.name as subject_name,
                   r.room_number
            FROM exams e
            JOIN classes c ON e.class_id = c.id
            JOIN subjects s ON e.subject_id = s.id
            LEFT JOIN rooms r ON e.room_id = r.id
            WHERE 1=1
        `;
        const queryParams = [];

        if (class_id) {
            query += ' AND e.class_id = $' + (queryParams.length + 1);
            queryParams.push(class_id);
        }

        if (subject_id) {
            query += ' AND e.subject_id = $' + (queryParams.length + 1);
            queryParams.push(subject_id);
        }

        if (exam_type) {
            query += ' AND e.exam_type = $' + (queryParams.length + 1);
            queryParams.push(exam_type);
        }

        if (start_date) {
            query += ' AND e.start_date >= $' + (queryParams.length + 1);
            queryParams.push(start_date);
        }

        if (end_date) {
            query += ' AND e.end_date <= $' + (queryParams.length + 1);
            queryParams.push(end_date);
        }

        query += ' ORDER BY e.start_date ASC';

        const exams = await pool.query(query, queryParams);
        res.json(exams.rows);
    } catch (error) {
        console.error('Error fetching exams:', error);
        res.status(500).json({ message: 'Server error while fetching exams' });
    }
};

// Get exam by ID
const getExamById = async (req, res) => {
    try {
        const { id } = req.params;

        const exam = await pool.query(
            `SELECT e.*, 
                    c.name as class_name,
                    s.name as subject_name,
                    r.room_number
             FROM exams e
             JOIN classes c ON e.class_id = c.id
             JOIN subjects s ON e.subject_id = s.id
             LEFT JOIN rooms r ON e.room_id = r.id
             WHERE e.id = $1`,
            [id]
        );

        if (exam.rows.length === 0) {
            return res.status(404).json({ message: 'Exam not found' });
        }

        res.json(exam.rows[0]);
    } catch (error) {
        console.error('Error fetching exam:', error);
        res.status(500).json({ message: 'Server error while fetching exam' });
    }
};

// Update exam
const updateExam = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            title, description, exam_type, start_date, end_date,
            total_marks, passing_marks, duration_minutes, room_id
        } = req.body;

        const updatedExam = await pool.query(
            `UPDATE exams 
             SET title = $1, 
                 description = $2, 
                 exam_type = $3, 
                 start_date = $4, 
                 end_date = $5,
                 total_marks = $6,
                 passing_marks = $7,
                 duration_minutes = $8,
                 room_id = $9,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $10 
             RETURNING *`,
            [title, description, exam_type, start_date, end_date,
             total_marks, passing_marks, duration_minutes, room_id, id]
        );

        if (updatedExam.rows.length === 0) {
            return res.status(404).json({ message: 'Exam not found' });
        }

        res.json(updatedExam.rows[0]);
    } catch (error) {
        console.error('Error updating exam:', error);
        res.status(500).json({ message: 'Server error while updating exam' });
    }
};

// Delete exam
const deleteExam = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedExam = await pool.query(
            'DELETE FROM exams WHERE id = $1 RETURNING *',
            [id]
        );

        if (deletedExam.rows.length === 0) {
            return res.status(404).json({ message: 'Exam not found' });
        }

        res.json({ message: 'Exam deleted successfully' });
    } catch (error) {
        console.error('Error deleting exam:', error);
        res.status(500).json({ message: 'Server error while deleting exam' });
    }
};

// Get exam schedule
const getExamSchedule = async (req, res) => {
    try {
        const { class_id, start_date, end_date } = req.query;

        const schedule = await pool.query(
            `SELECT e.*, 
                    s.name as subject_name,
                    r.room_number
             FROM exams e
             JOIN subjects s ON e.subject_id = s.id
             LEFT JOIN rooms r ON e.room_id = r.id
             WHERE e.class_id = $1 
             AND e.start_date BETWEEN $2 AND $3
             ORDER BY e.start_date ASC, e.start_time ASC`,
            [class_id, start_date, end_date]
        );

        res.json(schedule.rows);
    } catch (error) {
        console.error('Error fetching exam schedule:', error);
        res.status(500).json({ message: 'Server error while fetching schedule' });
    }
};

// Get exam results
const getExamResults = async (req, res) => {
    try {
        const { exam_id } = req.params;

        const results = await pool.query(
            `SELECT er.*, 
                    s.name as student_name,
                    s.roll_number
             FROM exam_results er
             JOIN students s ON er.student_id = s.id
             WHERE er.exam_id = $1
             ORDER BY s.roll_number ASC`,
            [exam_id]
        );

        res.json(results.rows);
    } catch (error) {
        console.error('Error fetching exam results:', error);
        res.status(500).json({ message: 'Server error while fetching results' });
    }
};

// Submit exam results
const submitExamResults = async (req, res) => {
    try {
        const { exam_id, results } = req.body;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const result of results) {
                await client.query(
                    `INSERT INTO exam_results (
                        exam_id, student_id, marks_obtained,
                        grade, remarks, created_at
                    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                    ON CONFLICT (exam_id, student_id) 
                    DO UPDATE SET 
                        marks_obtained = $3,
                        grade = $4,
                        remarks = $5,
                        updated_at = CURRENT_TIMESTAMP`,
                    [exam_id, result.student_id, result.marks_obtained,
                     result.grade, result.remarks]
                );
            }

            await client.query('COMMIT');
            res.status(201).json({ message: 'Results submitted successfully' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error submitting results:', error);
        res.status(500).json({ message: 'Server error while submitting results' });
    }
};

// Get exam statistics
const getExamStats = async (req, res) => {
    try {
        const { exam_id } = req.params;

        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_students,
                COUNT(CASE WHEN marks_obtained >= passing_marks THEN 1 END) as passed_students,
                COUNT(CASE WHEN marks_obtained < passing_marks THEN 1 END) as failed_students,
                ROUND(AVG(marks_obtained), 2) as average_marks,
                MAX(marks_obtained) as highest_marks,
                MIN(marks_obtained) as lowest_marks
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.id
             WHERE er.exam_id = $1`,
            [exam_id]
        );

        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Error fetching exam stats:', error);
        res.status(500).json({ message: 'Server error while fetching stats' });
    }
};

// Update the valid exam types in createExamPaper
const validExamTypes = [
    'unit_test_1',
    'unit_test_2',
    'custom_unit_test',
    'half_yearly',
    'annual'
];

// Add marking scheme constants
const MARKING_SCHEME = {
    objective: {
        correct: 1,
        incorrect: 0,
        partial: 0
    },
    short_answer: {
        correct: 2,
        incorrect: 0,
        partial: 1
    },
    long_answer: {
        correct: 5,
        incorrect: 0,
        partial: [1, 2, 3, 4] // Different levels of partial marks
    },
    practical: {
        correct: 3,
        incorrect: 0,
        partial: [1, 2] // Different levels of partial marks
    }
};

// Add function to validate marking scheme
const validateMarkingScheme = (questionType, marks) => {
    const scheme = MARKING_SCHEME[questionType];
    if (!scheme) return false;

    if (Array.isArray(scheme.partial)) {
        return scheme.partial.includes(marks) || marks === scheme.correct || marks === scheme.incorrect;
    }
    return marks === scheme.correct || marks === scheme.incorrect || marks === scheme.partial;
};

// Update createManualExamPaper to include marking scheme
const createManualExamPaper = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            exam_id,
            class_id,
            subject_id,
            exam_type,
            term,
            total_marks,
            duration_minutes,
            instructions,
            selected_questions,
            marking_scheme // New parameter for custom marking scheme
        } = req.body;

        // Validate CBSE class range (1-8)
        if (class_id < 1 || class_id > 8) {
            return res.status(400).json({
                success: false,
                message: 'Invalid class. Only CBSE classes 1-8 are supported.'
            });
        }

        // Validate exam type
        if (!validExamTypes.includes(exam_type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid exam type. Must be one of: unit_test_1, unit_test_2, custom_unit_test, half_yearly, annual'
            });
        }

        // Get subject details
        const [subjectDetails] = await connection.query(
            'SELECT name, code FROM subjects WHERE id = ?',
            [subject_id]
        );

        if (!subjectDetails.length) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        // Validate marking scheme if provided
        if (marking_scheme) {
            for (const [questionType, scheme] of Object.entries(marking_scheme)) {
                if (!MARKING_SCHEME[questionType]) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid question type in marking scheme: ${questionType}`
                    });
                }
            }
        }

        // Start transaction
        await connection.beginTransaction();

        // Insert exam paper
        const [result] = await connection.query(
            `INSERT INTO exam_papers (
                exam_id, class_id, subject_id, exam_type, term,
                total_marks, duration_minutes, instructions,
                is_manual, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, NOW(), NOW())`,
            [
                exam_id,
                class_id,
                subject_id,
                exam_type,
                term,
                total_marks,
                duration_minutes,
                instructions
            ]
        );

        const examPaperId = result.insertId;

        // Get selected questions with their sections
        const [selectedQuestions] = await connection.query(
            `SELECT q.*, s.section_type, s.title as section_title
             FROM question_bank q
             JOIN question_sections s ON q.section_id = s.id
             WHERE q.id IN (?)`,
            [selected_questions]
        );

        // Group questions by section
        const sectionGroups = selectedQuestions.reduce((acc, question) => {
            if (!acc[question.section_type]) {
                acc[question.section_type] = {
                    title: question.section_title,
                    section_type: question.section_type,
                    questions: []
                };
            }
            acc[question.section_type].questions.push(question);
            return acc;
        }, {});

        // Create sections and add questions
        for (const [sectionType, sectionData] of Object.entries(sectionGroups)) {
            const [sectionResult] = await connection.query(
                `INSERT INTO exam_sections (
                    exam_paper_id, title, description, section_type,
                    marks_per_question, total_questions, marking_scheme,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    examPaperId,
                    sectionData.title,
                    `Section for ${sectionType} questions`,
                    sectionType,
                    sectionData.questions[0].marks_per_question,
                    sectionData.questions.length,
                    JSON.stringify(marking_scheme?.[sectionType] || MARKING_SCHEME[sectionType])
                ]
            );

            const sectionId = sectionResult.insertId;

            // Add questions with marking scheme
            for (const question of sectionData.questions) {
                await connection.query(
                    `INSERT INTO exam_questions (
                        section_id, question_text, question_type,
                        marks, difficulty_level, skill_type,
                        solution, marking_scheme, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        sectionId,
                        question.question_text,
                        question.question_type,
                        question.marks,
                        question.difficulty_level,
                        question.skill_type,
                        question.solution,
                        JSON.stringify(marking_scheme?.[question.question_type] || MARKING_SCHEME[question.question_type])
                    ]
                );
            }
        }

        // Commit transaction
        await connection.commit();

        // Get complete exam paper
        const [examPaper] = await connection.query(
            `SELECT 
                ep.*,
                s.name as subject_name,
                s.code as subject_code,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id', es.id,
                        'title', es.title,
                        'description', es.description,
                        'section_type', es.section_type,
                        'marks_per_question', es.marks_per_question,
                        'total_questions', es.total_questions,
                        'questions', (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'id', eq.id,
                                    'question_text', eq.question_text,
                                    'question_type', eq.question_type,
                                    'marks', eq.marks,
                                    'difficulty_level', eq.difficulty_level,
                                    'skill_type', eq.skill_type,
                                    'solution', eq.solution
                                )
                            )
                            FROM exam_questions eq
                            WHERE eq.section_id = es.id
                        )
                    )
                ) as sections
            FROM exam_papers ep
            JOIN subjects s ON ep.subject_id = s.id
            LEFT JOIN exam_sections es ON es.exam_paper_id = ep.id
            WHERE ep.id = ?
            GROUP BY ep.id`,
            [examPaperId]
        );

        res.status(201).json({
            success: true,
            message: 'Manual CBSE exam paper created successfully',
            data: examPaper[0]
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating manual CBSE exam paper:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating manual CBSE exam paper',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

// Add function to get question bank for manual selection
const getQuestionBank = async (req, res) => {
    try {
        const { class_id, subject_id, section_type, difficulty_level } = req.query;

        let query = `
            SELECT q.*, s.section_type, s.title as section_title
            FROM question_bank q
            JOIN question_sections s ON q.section_id = s.id
            WHERE q.class_id = ? AND q.subject_id = ?
        `;
        const params = [class_id, subject_id];

        if (section_type) {
            query += ' AND s.section_type = ?';
            params.push(section_type);
        }

        if (difficulty_level) {
            query += ' AND q.difficulty_level = ?';
            params.push(difficulty_level);
        }

        query += ' ORDER BY s.section_type, q.difficulty_level';

        const [questions] = await pool.query(query, params);

        res.json({
            success: true,
            data: questions
        });

    } catch (error) {
        console.error('Error fetching question bank:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching question bank',
            error: error.message
        });
    }
};

// Create exam paper
const createExamPaper = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            exam_id,
            class_id,
            subject_id,
            exam_type,
            term,
            total_marks,
            duration_minutes,
            instructions,
            sections
        } = req.body;

        // Validate CBSE class range (1-8)
        if (class_id < 1 || class_id > 8) {
            return res.status(400).json({
                success: false,
                message: 'Invalid class. Only CBSE classes 1-8 are supported.'
            });
        }

        // Validate CBSE exam types
        const validExamTypes = ['unit_test', 'half_yearly', 'annual'];
        if (!validExamTypes.includes(exam_type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid exam type. Must be one of: unit_test, half_yearly, annual'
            });
        }

        // Get subject details for CBSE pattern
        const [subjectDetails] = await connection.query(
            'SELECT name, code FROM subjects WHERE id = ?',
            [subject_id]
        );

        if (!subjectDetails.length) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        // Start transaction
        await connection.beginTransaction();

        // Insert exam paper with CBSE specific details
        const [result] = await connection.query(
            `INSERT INTO exam_papers (
                exam_id, class_id, subject_id, exam_type, term,
                total_marks, duration_minutes, instructions,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                exam_id,
                class_id,
                subject_id,
                exam_type,
                term,
                total_marks,
                duration_minutes,
                instructions
            ]
        );

        const examPaperId = result.insertId;

        // Create sections based on CBSE pattern
        for (const section of sections) {
            const [sectionResult] = await connection.query(
                `INSERT INTO exam_sections (
                    exam_paper_id, title, description, section_type,
                    marks_per_question, total_questions, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    examPaperId,
                    section.title,
                    section.description,
                    section.section_type,
                    section.marks_per_question,
                    section.questions.length
                ]
            );

            const sectionId = sectionResult.insertId;

            // Create questions with CBSE specific attributes
            for (const question of section.questions) {
                await connection.query(
                    `INSERT INTO exam_questions (
                        section_id, question_text, question_type,
                        marks, difficulty_level, skill_type,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        sectionId,
                        question.question_text,
                        question.question_type,
                        question.marks,
                        question.difficulty_level,
                        question.skill_type
                    ]
                );
            }
        }

        // Commit transaction
        await connection.commit();

        // Get complete exam paper with sections and questions
        const [examPaper] = await connection.query(
            `SELECT 
                ep.*,
                s.name as subject_name,
                s.code as subject_code,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id', es.id,
                        'title', es.title,
                        'description', es.description,
                        'section_type', es.section_type,
                        'marks_per_question', es.marks_per_question,
                        'total_questions', es.total_questions,
                        'questions', (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'id', eq.id,
                                    'question_text', eq.question_text,
                                    'question_type', eq.question_type,
                                    'marks', eq.marks,
                                    'difficulty_level', eq.difficulty_level,
                                    'skill_type', eq.skill_type
                                )
                            )
                            FROM exam_questions eq
                            WHERE eq.section_id = es.id
                        )
                    )
                ) as sections
            FROM exam_papers ep
            JOIN subjects s ON ep.subject_id = s.id
            LEFT JOIN exam_sections es ON es.exam_paper_id = ep.id
            WHERE ep.id = ?
            GROUP BY ep.id`,
            [examPaperId]
        );

        res.status(201).json({
            success: true,
            message: 'CBSE exam paper created successfully',
            data: examPaper[0]
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating CBSE exam paper:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating CBSE exam paper',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

// Get exam paper
const getExamPaper = async (req, res) => {
    try {
        const { exam_id } = req.params;

        const examPaper = await pool.query(
            `SELECT 
                ep.*,
                s.name as subject_name,
                s.subject_code,
                json_agg(
                    json_build_object(
                        'section_id', es.id,
                        'title', es.title,
                        'description', es.description,
                        'marks_per_question', es.marks_per_question,
                        'total_questions', es.total_questions,
                        'section_type', es.section_type,
                        'questions', (
                            SELECT json_agg(
                                json_build_object(
                                    'question_id', eq.id,
                                    'question_text', eq.question_text,
                                    'question_type', eq.question_type,
                                    'marks', eq.marks,
                                    'difficulty_level', eq.difficulty_level,
                                    'skill_type', eq.skill_type
                                )
                            )
                            FROM exam_questions eq
                            WHERE eq.section_id = es.id
                        )
                    )
                ) as sections
            FROM exam_papers ep
            JOIN subjects s ON ep.subject_id = s.id
            JOIN exam_sections es ON es.exam_paper_id = ep.id
            WHERE ep.exam_id = $1
            GROUP BY ep.id, s.name, s.subject_code`,
            [exam_id]
        );

        if (examPaper.rows.length === 0) {
            return res.status(404).json({ message: 'Exam paper not found' });
        }

        res.json(examPaper.rows[0]);
    } catch (error) {
        console.error('Error fetching exam paper:', error);
        res.status(500).json({ message: 'Server error while fetching exam paper' });
    }
};

// Add function to get CBSE exam patterns
const getCBSEExamPattern = async (req, res) => {
    try {
        const { class_id, subject_id, exam_type } = req.query;

        // Validate class range
        if (class_id < 1 || class_id > 8) {
            return res.status(400).json({
                success: false,
                message: 'Invalid class. Only CBSE classes 1-8 are supported.'
            });
        }

        // Get subject details
        const [subjectDetails] = await pool.query(
            'SELECT name, code FROM subjects WHERE id = ?',
            [subject_id]
        );

        if (!subjectDetails.length) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        // Get CBSE pattern based on class and subject
        const pattern = {
            class_id,
            subject: subjectDetails[0].name,
            exam_type,
            total_marks: getTotalMarks(class_id, exam_type),
            duration_minutes: getDuration(class_id, exam_type),
            sections: getSectionPattern(class_id, subjectDetails[0].name, exam_type)
        };

        res.json({
            success: true,
            data: pattern
        });

    } catch (error) {
        console.error('Error getting CBSE exam pattern:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting CBSE exam pattern',
            error: error.message
        });
    }
};

// Helper functions for CBSE patterns
const getTotalMarks = (class_id, exam_type) => {
    const marks = {
        unit_test: {
            1: 25,
            2: 25,
            3: 25,
            4: 25,
            5: 25,
            6: 25,
            7: 25,
            8: 25
        },
        half_yearly: {
            1: 50,
            2: 50,
            3: 50,
            4: 50,
            5: 50,
            6: 50,
            7: 50,
            8: 50
        },
        annual: {
            1: 100,
            2: 100,
            3: 100,
            4: 100,
            5: 100,
            6: 100,
            7: 100,
            8: 100
        }
    };
    return marks[exam_type][class_id];
};

const getDuration = (class_id, exam_type) => {
    const duration = {
        unit_test: {
            1: 60,
            2: 60,
            3: 60,
            4: 60,
            5: 60,
            6: 60,
            7: 60,
            8: 60
        },
        half_yearly: {
            1: 120,
            2: 120,
            3: 120,
            4: 120,
            5: 120,
            6: 120,
            7: 120,
            8: 120
        },
        annual: {
            1: 180,
            2: 180,
            3: 180,
            4: 180,
            5: 180,
            6: 180,
            7: 180,
            8: 180
        }
    };
    return duration[exam_type][class_id];
};

const getSectionPattern = (class_id, subject, exam_type) => {
    // Common section types for all subjects
    const commonSections = [
        {
            title: 'Objective Type Questions',
            section_type: 'objective',
            marks_per_question: 1,
            total_questions: 10
        },
        {
            title: 'Short Answer Questions',
            section_type: 'short_answer',
            marks_per_question: 2,
            total_questions: 5
        }
    ];

    // Subject-specific sections
    const subjectSections = {
        'Mathematics': [
            {
                title: 'Problem Solving',
                section_type: 'problem_solving',
                marks_per_question: 3,
                total_questions: 5
            }
        ],
        'Science': [
            {
                title: 'Practical Based Questions',
                section_type: 'practical',
                marks_per_question: 3,
                total_questions: 5
            }
        ],
        'English': [
            {
                title: 'Comprehension',
                section_type: 'comprehension',
                marks_per_question: 3,
                total_questions: 5
            }
        ],
        'Social Studies': [
            {
                title: 'Map Work',
                section_type: 'map_work',
                marks_per_question: 3,
                total_questions: 5
            }
        ]
    };

    return [
        ...commonSections,
        ...(subjectSections[subject] || [])
    ];
};

// Add function to get marking scheme
const getMarkingScheme = async (req, res) => {
    try {
        const { class_id, subject_id, exam_type } = req.query;

        // Get default marking scheme
        const defaultScheme = { ...MARKING_SCHEME };

        // Get subject-specific marking scheme if exists
        const [subjectScheme] = await pool.query(
            `SELECT marking_scheme FROM subject_marking_schemes 
             WHERE class_id = ? AND subject_id = ? AND exam_type = ?`,
            [class_id, subject_id, exam_type]
        );

        const markingScheme = subjectScheme.length > 0 
            ? JSON.parse(subjectScheme[0].marking_scheme)
            : defaultScheme;

        res.json({
            success: true,
            data: markingScheme
        });

    } catch (error) {
        console.error('Error fetching marking scheme:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching marking scheme',
            error: error.message
        });
    }
};

// Add function to update marking scheme
const updateMarkingScheme = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { class_id, subject_id, exam_type, marking_scheme } = req.body;

        // Validate marking scheme
        for (const [questionType, scheme] of Object.entries(marking_scheme)) {
            if (!MARKING_SCHEME[questionType]) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid question type in marking scheme: ${questionType}`
                });
            }
        }

        await connection.beginTransaction();

        // Update or insert marking scheme
        await connection.query(
            `INSERT INTO subject_marking_schemes (
                class_id, subject_id, exam_type, marking_scheme,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                marking_scheme = VALUES(marking_scheme),
                updated_at = NOW()`,
            [class_id, subject_id, exam_type, JSON.stringify(marking_scheme)]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Marking scheme updated successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating marking scheme:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating marking scheme',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

// Add student performance statistics
const getStudentPerformanceStats = async (req, res) => {
    try {
        const { student_id, class_id, subject_id, exam_type, term } = req.query;

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

// Download exam paper as PDF
const downloadExamPaperPDF = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const { format = 'pdf' } = req.query;

        // Get exam paper details
        const examPaper = await pool.query(
            `SELECT 
                ep.*,
                s.name as subject_name,
                s.code as subject_code,
                c.name as class_name,
                json_agg(
                    json_build_object(
                        'section_id', es.id,
                        'title', es.title,
                        'description', es.description,
                        'marks_per_question', es.marks_per_question,
                        'total_questions', es.total_questions,
                        'section_type', es.section_type,
                        'questions', (
                            SELECT json_agg(
                                json_build_object(
                                    'question_id', eq.id,
                                    'question_text', eq.question_text,
                                    'question_type', eq.question_type,
                                    'marks', eq.marks,
                                    'difficulty_level', eq.difficulty_level,
                                    'skill_type', eq.skill_type
                                )
                            )
                            FROM exam_questions eq
                            WHERE eq.section_id = es.id
                        )
                    )
                ) as sections
            FROM exam_papers ep
            JOIN subjects s ON ep.subject_id = s.id
            JOIN classes c ON ep.class_id = c.id
            JOIN exam_sections es ON es.exam_paper_id = ep.id
            WHERE ep.exam_id = $1
            GROUP BY ep.id, s.name, s.code, c.name`,
            [exam_id]
        );

        if (examPaper.rows.length === 0) {
            return res.status(404).json({ message: 'Exam paper not found' });
        }

        const paper = examPaper.rows[0];

        if (format === 'pdf') {
            // Create PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=exam_paper_${exam_id}.pdf`);

            // Pipe PDF to response
            doc.pipe(res);

            // Add header
            doc.fontSize(20).text('CBSE Examination Paper', { align: 'center' });
            doc.moveDown();
            doc.fontSize(16).text(`Class: ${paper.class_name}`, { align: 'center' });
            doc.fontSize(16).text(`Subject: ${paper.subject_name} (${paper.subject_code})`, { align: 'center' });
            doc.fontSize(16).text(`Exam Type: ${paper.exam_type}`, { align: 'center' });
            doc.fontSize(16).text(`Term: ${paper.term}`, { align: 'center' });
            doc.moveDown();

            // Add instructions
            doc.fontSize(12).text('General Instructions:', { underline: true });
            doc.fontSize(10).text(paper.instructions);
            doc.moveDown();

            // Add sections and questions
            paper.sections.forEach((section, index) => {
                doc.fontSize(14).text(`Section ${index + 1}: ${section.title}`, { underline: true });
                doc.fontSize(10).text(section.description);
                doc.moveDown();

                section.questions.forEach((question, qIndex) => {
                    doc.fontSize(12).text(`Q${qIndex + 1}. ${question.question_text}`);
                    doc.fontSize(10).text(`[${question.marks} Marks]`);
                    doc.moveDown();
                });
            });

            // Finalize PDF
            doc.end();
        } else if (format === 'docx') {
            // Create DOCX document
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            text: 'CBSE Examination Paper',
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: `Class: ${paper.class_name}`,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: `Subject: ${paper.subject_name} (${paper.subject_code})`,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: `Exam Type: ${paper.exam_type}`,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: `Term: ${paper.term}`,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: 'General Instructions:',
                            heading: HeadingLevel.HEADING_2
                        }),
                        new Paragraph({
                            text: paper.instructions
                        }),
                        ...paper.sections.flatMap((section, index) => [
                            new Paragraph({
                                text: `Section ${index + 1}: ${section.title}`,
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                text: section.description
                            }),
                            ...section.questions.map((question, qIndex) => 
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: `Q${qIndex + 1}. ${question.question_text}`,
                                            bold: true
                                        }),
                                        new TextRun({
                                            text: ` [${question.marks} Marks]`
                                        })
                                    ]
                                })
                            )
                        ])
                    ]
                }]
            });

            // Generate DOCX buffer
            const buffer = await docx.Packer.toBuffer(doc);

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=exam_paper_${exam_id}.docx`);

            // Send DOCX file
            res.send(buffer);
        } else {
            return res.status(400).json({ message: 'Invalid format. Supported formats: pdf, docx' });
        }
    } catch (error) {
        console.error('Error downloading exam paper:', error);
        res.status(500).json({ message: 'Server error while downloading exam paper' });
    }
};

module.exports = {
    createExam,
    getAllExams,
    getExamById,
    updateExam,
    deleteExam,
    getExamSchedule,
    getExamResults,
    submitExamResults,
    getExamStats,
    createExamPaper,
    getExamPaper,
    getCBSEExamPattern,
    createManualExamPaper,
    getQuestionBank,
    getMarkingScheme,
    updateMarkingScheme,
    validateMarkingScheme,
    getStudentPerformanceStats,
    downloadExamPaperPDF
}; 
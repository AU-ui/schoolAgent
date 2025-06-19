const pool = require('../config/db');

// Get all books
const getAllBooks = async (req, res) => {
    try {
        const { search, category, status } = req.query;
        let query = `
            SELECT 
                b.*,
                c.name as category_name,
                COUNT(DISTINCT br.id) as total_borrows,
                CASE 
                    WHEN b.available_copies > 0 THEN 'available'
                    ELSE 'unavailable'
                END as availability_status
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.id
            LEFT JOIN book_borrows br ON b.id = br.book_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (b.title ILIKE $${params.length + 1} OR b.author ILIKE $${params.length + 1} OR b.isbn ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }

        if (category) {
            query += ` AND b.category_id = $${params.length + 1}`;
            params.push(category);
        }

        if (status) {
            query += ` AND CASE 
                WHEN b.available_copies > 0 THEN 'available'
                ELSE 'unavailable'
            END = $${params.length + 1}`;
            params.push(status);
        }

        query += ` GROUP BY b.id, c.name ORDER BY b.title`;

        const [books] = await pool.query(query, params);
        res.json(books);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ message: 'Server error while fetching books' });
    }
};

// Add new book
const addBook = async (req, res) => {
    try {
        const {
            title,
            author,
            isbn,
            category_id,
            total_copies,
            available_copies,
            publication_year,
            publisher,
            description,
            location
        } = req.body;

        const [book] = await pool.query(
            `INSERT INTO books (
                title, author, isbn, category_id, total_copies,
                available_copies, publication_year, publisher,
                description, location
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [title, author, isbn, category_id, total_copies, available_copies,
             publication_year, publisher, description, location]
        );

        res.status(201).json(book);
    } catch (error) {
        console.error('Error adding book:', error);
        res.status(500).json({ message: 'Server error while adding book' });
    }
};

// Borrow book
const borrowBook = async (req, res) => {
    try {
        const { book_id, student_id, borrow_date, due_date } = req.body;

        // Start transaction
        await pool.query('BEGIN');

        // Check book availability
        const [book] = await pool.query(
            'SELECT available_copies FROM books WHERE id = $1',
            [book_id]
        );

        if (!book.length || book[0].available_copies <= 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Book is not available for borrowing' });
        }

        // Create borrow record
        const [borrow] = await pool.query(
            `INSERT INTO book_borrows (
                book_id, student_id, borrow_date, due_date, status
            ) VALUES ($1, $2, $3, $4, 'borrowed')
            RETURNING *`,
            [book_id, student_id, borrow_date, due_date]
        );

        // Update available copies
        await pool.query(
            'UPDATE books SET available_copies = available_copies - 1 WHERE id = $1',
            [book_id]
        );

        await pool.query('COMMIT');
        res.status(201).json(borrow);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error borrowing book:', error);
        res.status(500).json({ message: 'Server error while borrowing book' });
    }
};

// Return book
const returnBook = async (req, res) => {
    try {
        const { borrow_id, return_date, condition } = req.body;

        // Start transaction
        await pool.query('BEGIN');

        // Get borrow record
        const [borrow] = await pool.query(
            'SELECT book_id FROM book_borrows WHERE id = $1 AND status = $2',
            [borrow_id, 'borrowed']
        );

        if (!borrow.length) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Borrow record not found' });
        }

        // Update borrow record
        await pool.query(
            `UPDATE book_borrows 
             SET status = 'returned', return_date = $1, condition = $2
             WHERE id = $3`,
            [return_date, condition, borrow_id]
        );

        // Update available copies
        await pool.query(
            'UPDATE books SET available_copies = available_copies + 1 WHERE id = $1',
            [borrow[0].book_id]
        );

        await pool.query('COMMIT');
        res.json({ message: 'Book returned successfully' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error returning book:', error);
        res.status(500).json({ message: 'Server error while returning book' });
    }
};

// Get student's borrowed books
const getStudentBorrows = async (req, res) => {
    try {
        const { student_id, status } = req.query;

        const [borrows] = await pool.query(
            `SELECT 
                br.*,
                b.title,
                b.author,
                b.isbn,
                c.name as category_name
             FROM book_borrows br
             JOIN books b ON br.book_id = b.id
             JOIN categories c ON b.category_id = c.id
             WHERE br.student_id = $1
             ${status ? 'AND br.status = $2' : ''}
             ORDER BY br.borrow_date DESC`,
            [student_id, status].filter(Boolean)
        );

        res.json(borrows);
    } catch (error) {
        console.error('Error fetching student borrows:', error);
        res.status(500).json({ message: 'Server error while fetching student borrows' });
    }
};

// Get overdue books
const getOverdueBooks = async (req, res) => {
    try {
        const [overdue] = await pool.query(
            `SELECT 
                br.*,
                b.title,
                b.author,
                s.name as student_name,
                s.admission_number,
                c.name as class_name,
                c.section,
                CURRENT_DATE - br.due_date as days_overdue
             FROM book_borrows br
             JOIN books b ON br.book_id = b.id
             JOIN students s ON br.student_id = s.id
             JOIN classes c ON s.class_id = c.id
             WHERE br.status = 'borrowed'
             AND br.due_date < CURRENT_DATE
             ORDER BY days_overdue DESC`
        );

        res.json(overdue);
    } catch (error) {
        console.error('Error fetching overdue books:', error);
        res.status(500).json({ message: 'Server error while fetching overdue books' });
    }
};

// Get library statistics
const getLibraryStats = async (req, res) => {
    try {
        const [stats] = await pool.query(
            `SELECT 
                COUNT(DISTINCT b.id) as total_books,
                SUM(b.total_copies) as total_copies,
                SUM(b.available_copies) as available_copies,
                COUNT(DISTINCT CASE WHEN br.status = 'borrowed' THEN br.id END) as currently_borrowed,
                COUNT(DISTINCT CASE WHEN br.status = 'returned' THEN br.id END) as total_returns,
                COUNT(DISTINCT CASE WHEN br.due_date < CURRENT_DATE AND br.status = 'borrowed' THEN br.id END) as overdue_books
             FROM books b
             LEFT JOIN book_borrows br ON b.id = br.book_id`
        );

        // Get category-wise distribution
        const [categoryStats] = await pool.query(
            `SELECT 
                c.name as category,
                COUNT(DISTINCT b.id) as total_books,
                SUM(b.total_copies) as total_copies,
                SUM(b.available_copies) as available_copies
             FROM categories c
             LEFT JOIN books b ON c.id = b.category_id
             GROUP BY c.id, c.name
             ORDER BY total_books DESC`
        );

        res.json({
            overall_stats: stats[0],
            category_stats: categoryStats
        });
    } catch (error) {
        console.error('Error fetching library statistics:', error);
        res.status(500).json({ message: 'Server error while fetching library statistics' });
    }
};

module.exports = {
    getAllBooks,
    addBook,
    borrowBook,
    returnBook,
    getStudentBorrows,
    getOverdueBooks,
    getLibraryStats
}; 
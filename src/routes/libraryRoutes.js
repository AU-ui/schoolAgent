const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all library books
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM library_books');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new library book
router.post('/', async (req, res) => {
    try {
        const { title, author, isbn, category, available_copies } = req.body;
        const result = await pool.query(
            'INSERT INTO library_books (title, author, isbn, category, available_copies) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [title, author, isbn, category, available_copies]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a library book
router.put('/:bookId', async (req, res) => {
    try {
        const { bookId } = req.params;
        const { title, author, isbn, category, available_copies } = req.body;
        const result = await pool.query(
            'UPDATE library_books SET title = $1, author = $2, isbn = $3, category = $4, available_copies = $5 WHERE id = $6 RETURNING *',
            [title, author, isbn, category, available_copies, bookId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a library book
router.delete('/:bookId', async (req, res) => {
    try {
        const { bookId } = req.params;
        const result = await pool.query('DELETE FROM library_books WHERE id = $1 RETURNING *', [bookId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.json({ message: 'Book deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
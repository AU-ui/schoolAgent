const express = require('express');
const { pool } = require('./config/db');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());

// Test database connection
app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            message: 'Database connection successful!',
            time: result.rows[0].now
        });
    } catch (err) {
        res.status(500).json({
            message: 'Database connection failed',
            error: err.message
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 
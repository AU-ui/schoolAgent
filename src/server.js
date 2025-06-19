const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('./middleware/authMiddleware');
const validationMiddleware = require('./middleware/validationMiddleware');
const errorHandlingMiddleware = require('./middleware/errorHandlingMiddleware');
const loggingMiddleware = require('./middleware/loggingMiddleware');
const rateLimitMiddleware = require('./middleware/rateLimitMiddleware');
const corsMiddleware = require('./middleware/corsMiddleware');
const securityMiddleware = require('./middleware/securityMiddleware');
const routes = require('./routes');
const { pool } = require('./config/db');
require('dotenv').config();
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');

const app = express();

// Middleware
app.use(express.json());
app.use(corsMiddleware);
app.use(helmet());
app.use(morgan('dev'));
app.use(rateLimitMiddleware);

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

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Routes
app.use('/api', routes);

// Error handling middleware
app.use(errorHandlingMiddleware);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 
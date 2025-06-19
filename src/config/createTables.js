const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'school_management',
    password: process.env.DB_PASSWORD || 'your_password',
    port: process.env.DB_PORT || 5432,
});

async function createTables() {
    try {
        // Create users table (for authentication)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL CHECK (role IN ('superAdmin', 'schoolAdmin', 'teacher', 'parent', 'student')),
                reset_token VARCHAR(255),
                reset_token_expiry TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_verified BOOLEAN DEFAULT FALSE,
                email_verification_token VARCHAR,
                token_expiry TIMESTAMP
            );
        `);
        console.log('Users table created successfully');

        // Create teacher_tasks table (for Teacher Administrative Burden)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS teacher_tasks (
                id SERIAL PRIMARY KEY,
                teacher_id INTEGER REFERENCES users(id),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                due_date DATE,
                status VARCHAR(20) CHECK (status IN ('pending', 'in_progress', 'completed')) NOT NULL,
                priority VARCHAR(20) CHECK (priority IN ('high', 'medium', 'low')) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Teacher tasks table created successfully');

        // Create parent_messages table (for Parent-School Communication)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS parent_messages (
                id SERIAL PRIMARY KEY,
                teacher_id INTEGER REFERENCES users(id),
                parent_id INTEGER REFERENCES users(id),
                message TEXT NOT NULL,
                status VARCHAR(20) CHECK (status IN ('sent', 'read', 'replied')) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Parent messages table created successfully');

        console.log('All tables created successfully');
    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        await pool.end();
    }
}

createTables(); 
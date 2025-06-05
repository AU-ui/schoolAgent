const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// User table creation query
const createUserTable = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('superAdmin', 'schoolAdmin', 'teacher', 'parent', 'student')) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

// Initialize table
pool.query(createUserTable)
    .then(() => console.log('Users table created or already exists'))
    .catch(err => console.error('Error creating users table:', err));

class User {
    // Create new user
    static async create(userData) {
        const { name, email, password, role } = userData;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const query = `
            INSERT INTO users (name, email, password, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, email, role, is_active, created_at;
        `;
        
        try {
            const result = await pool.query(query, [name, email, hashedPassword, role]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Find user by email
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        try {
            const result = await pool.query(query, [email]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Find user by ID
    static async findById(id) {
        const query = 'SELECT * FROM users WHERE id = $1';
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Update user
    static async update(id, updateData) {
        const { name, email, role, is_active } = updateData;
        const query = `
            UPDATE users 
            SET name = $1, email = $2, role = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *;
        `;
        try {
            const result = await pool.query(query, [name, email, role, is_active, id]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Update last login
    static async updateLastLogin(id) {
        const query = `
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `;
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Compare password
    static async comparePassword(plainPassword, hashedPassword) {
        try {
            return await bcrypt.compare(plainPassword, hashedPassword);
        } catch (error) {
            throw error;
        }
    }
}

module.exports = User; 
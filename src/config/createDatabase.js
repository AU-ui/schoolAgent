const { Client } = require('pg');
require('dotenv').config();

async function createDatabase() {
    // Connect to default postgres database
    const client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: 'postgres', // Connect to default database
        password: process.env.DB_PASSWORD || 'your_password',
        port: process.env.DB_PORT || 5432,
    });

    try {
        await client.connect();
        console.log('Connected to PostgreSQL');

        // Create database if it doesn't exist
        const result = await client.query(
            `SELECT 1 FROM pg_database WHERE datname = 'school_management'`
        );

        if (result.rows.length === 0) {
            await client.query('CREATE DATABASE school_management');
            console.log('Database created successfully');
        } else {
            console.log('Database already exists');
        }
    } catch (err) {
        console.error('Error creating database:', err);
    } finally {
        await client.end();
    }
}

createDatabase(); 
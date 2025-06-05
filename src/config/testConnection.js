const { pool } = require('./db');

async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('Database connection successful!');
        console.log('Current database time:', result.rows[0].now);
    } catch (err) {
        console.error('Database connection failed:', err);
    } finally {
        await pool.end();
    }
}

testConnection(); 
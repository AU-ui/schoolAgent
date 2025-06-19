const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Get all transport routes
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM transport_routes');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create a new transport route
router.post('/', async (req, res) => {
    try {
        const { route_name, vehicle_number, driver_name, capacity, stops } = req.body;
        const result = await pool.query(
            'INSERT INTO transport_routes (route_name, vehicle_number, driver_name, capacity, stops) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [route_name, vehicle_number, driver_name, capacity, stops]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update a transport route
router.put('/:routeId', async (req, res) => {
    try {
        const { routeId } = req.params;
        const { route_name, vehicle_number, driver_name, capacity, stops } = req.body;
        const result = await pool.query(
            'UPDATE transport_routes SET route_name = $1, vehicle_number = $2, driver_name = $3, capacity = $4, stops = $5 WHERE id = $6 RETURNING *',
            [route_name, vehicle_number, driver_name, capacity, stops, routeId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Transport route not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a transport route
router.delete('/:routeId', async (req, res) => {
    try {
        const { routeId } = req.params;
        const result = await pool.query('DELETE FROM transport_routes WHERE id = $1 RETURNING *', [routeId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Transport route not found' });
        }
        res.json({ message: 'Transport route deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 
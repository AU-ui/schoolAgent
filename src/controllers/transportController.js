const pool = require('../config/db');

// Get all routes
const getAllRoutes = async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = `
            SELECT 
                r.*,
                v.vehicle_number,
                v.capacity,
                v.model,
                d.name as driver_name,
                d.phone as driver_phone,
                COUNT(DISTINCT s.id) as total_students,
                CASE 
                    WHEN COUNT(DISTINCT s.id) >= v.capacity THEN 'full'
                    ELSE 'available'
                END as route_status
            FROM routes r
            LEFT JOIN vehicles v ON r.vehicle_id = v.id
            LEFT JOIN drivers d ON r.driver_id = d.id
            LEFT JOIN student_transport st ON r.id = st.route_id
            LEFT JOIN students s ON st.student_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (r.route_name ILIKE $${params.length + 1} OR r.start_location ILIKE $${params.length + 1} OR r.end_location ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }

        if (status) {
            query += ` AND CASE 
                WHEN COUNT(DISTINCT s.id) >= v.capacity THEN 'full'
                ELSE 'available'
            END = $${params.length + 1}`;
            params.push(status);
        }

        query += ` GROUP BY r.id, v.vehicle_number, v.capacity, v.model, d.name, d.phone ORDER BY r.route_name`;

        const [routes] = await pool.query(query, params);
        res.json(routes);
    } catch (error) {
        console.error('Error fetching routes:', error);
        res.status(500).json({ message: 'Server error while fetching routes' });
    }
};

// Create new route
const createRoute = async (req, res) => {
    try {
        const {
            route_name,
            start_location,
            end_location,
            vehicle_id,
            driver_id,
            departure_time,
            arrival_time,
            stops,
            distance,
            fare
        } = req.body;

        const [route] = await pool.query(
            `INSERT INTO routes (
                route_name, start_location, end_location, vehicle_id,
                driver_id, departure_time, arrival_time, stops,
                distance, fare
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [route_name, start_location, end_location, vehicle_id,
             driver_id, departure_time, arrival_time, stops,
             distance, fare]
        );

        res.status(201).json(route);
    } catch (error) {
        console.error('Error creating route:', error);
        res.status(500).json({ message: 'Server error while creating route' });
    }
};

// Assign student to route
const assignStudentToRoute = async (req, res) => {
    try {
        const { student_id, route_id, stop_name, pickup_time, drop_time } = req.body;

        // Start transaction
        await pool.query('BEGIN');

        // Check route capacity
        const [route] = await pool.query(
            `SELECT 
                v.capacity,
                COUNT(st.id) as current_students
             FROM routes r
             JOIN vehicles v ON r.vehicle_id = v.id
             LEFT JOIN student_transport st ON r.id = st.route_id
             WHERE r.id = $1
             GROUP BY v.capacity`,
            [route_id]
        );

        if (!route.length) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Route not found' });
        }

        if (route[0].current_students >= route[0].capacity) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Route is full' });
        }

        // Assign student
        const [assignment] = await pool.query(
            `INSERT INTO student_transport (
                student_id, route_id, stop_name, pickup_time, drop_time, status
            ) VALUES ($1, $2, $3, $4, $5, 'active')
            RETURNING *`,
            [student_id, route_id, stop_name, pickup_time, drop_time]
        );

        await pool.query('COMMIT');
        res.status(201).json(assignment);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error assigning student to route:', error);
        res.status(500).json({ message: 'Server error while assigning student to route' });
    }
};

// Get route students
const getRouteStudents = async (req, res) => {
    try {
        const { route_id } = req.params;

        const [students] = await pool.query(
            `SELECT 
                st.*,
                s.name as student_name,
                s.admission_number,
                c.name as class_name,
                c.section
             FROM student_transport st
             JOIN students s ON st.student_id = s.id
             JOIN classes c ON s.class_id = c.id
             WHERE st.route_id = $1
             ORDER BY st.stop_name, st.pickup_time`,
            [route_id]
        );

        res.json(students);
    } catch (error) {
        console.error('Error fetching route students:', error);
        res.status(500).json({ message: 'Server error while fetching route students' });
    }
};

// Update route status
const updateRouteStatus = async (req, res) => {
    try {
        const { route_id } = req.params;
        const { status, notes } = req.body;

        const [route] = await pool.query(
            `UPDATE routes 
             SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [status, notes, route_id]
        );

        if (!route.length) {
            return res.status(404).json({ message: 'Route not found' });
        }

        res.json(route[0]);
    } catch (error) {
        console.error('Error updating route status:', error);
        res.status(500).json({ message: 'Server error while updating route status' });
    }
};

// Get student's transport details
const getStudentTransport = async (req, res) => {
    try {
        const { student_id } = req.params;

        const [transport] = await pool.query(
            `SELECT 
                st.*,
                r.route_name,
                r.start_location,
                r.end_location,
                r.departure_time,
                r.arrival_time,
                v.vehicle_number,
                v.model,
                d.name as driver_name,
                d.phone as driver_phone
             FROM student_transport st
             JOIN routes r ON st.route_id = r.id
             JOIN vehicles v ON r.vehicle_id = v.id
             JOIN drivers d ON r.driver_id = d.id
             WHERE st.student_id = $1
             AND st.status = 'active'`,
            [student_id]
        );

        res.json(transport);
    } catch (error) {
        console.error('Error fetching student transport:', error);
        res.status(500).json({ message: 'Server error while fetching student transport' });
    }
};

// Get transport statistics
const getTransportStats = async (req, res) => {
    try {
        const [stats] = await pool.query(
            `SELECT 
                COUNT(DISTINCT r.id) as total_routes,
                COUNT(DISTINCT v.id) as total_vehicles,
                COUNT(DISTINCT d.id) as total_drivers,
                COUNT(DISTINCT st.student_id) as total_students,
                COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_routes,
                COUNT(DISTINCT CASE WHEN v.status = 'active' THEN v.id END) as active_vehicles
             FROM routes r
             LEFT JOIN vehicles v ON r.vehicle_id = v.id
             LEFT JOIN drivers d ON r.driver_id = d.id
             LEFT JOIN student_transport st ON r.id = st.route_id`
        );

        // Get route-wise distribution
        const [routeStats] = await pool.query(
            `SELECT 
                r.route_name,
                COUNT(DISTINCT st.student_id) as total_students,
                v.capacity,
                CASE 
                    WHEN COUNT(DISTINCT st.student_id) >= v.capacity THEN 'full'
                    ELSE 'available'
                END as status
             FROM routes r
             JOIN vehicles v ON r.vehicle_id = v.id
             LEFT JOIN student_transport st ON r.id = st.route_id
             GROUP BY r.id, r.route_name, v.capacity
             ORDER BY total_students DESC`
        );

        res.json({
            overall_stats: stats[0],
            route_stats: routeStats
        });
    } catch (error) {
        console.error('Error fetching transport statistics:', error);
        res.status(500).json({ message: 'Server error while fetching transport statistics' });
    }
};

module.exports = {
    getAllRoutes,
    createRoute,
    assignStudentToRoute,
    getRouteStudents,
    updateRouteStatus,
    getStudentTransport,
    getTransportStats
}; 
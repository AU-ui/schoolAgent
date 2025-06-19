const pool = require('../config/db');

// Get all holidays
const getAllHolidays = async (req, res) => {
    try {
        const { year, month, type } = req.query;
        let query = `
            SELECT 
                h.*,
                CASE 
                    WHEN h.start_date <= CURRENT_DATE AND h.end_date >= CURRENT_DATE THEN 'current'
                    WHEN h.start_date > CURRENT_DATE THEN 'upcoming'
                    ELSE 'past'
                END as status
            FROM holidays h
            WHERE 1=1
        `;
        const params = [];

        if (year) {
            query += ` AND EXTRACT(YEAR FROM h.start_date) = $${params.length + 1}`;
            params.push(year);
        }

        if (month) {
            query += ` AND EXTRACT(MONTH FROM h.start_date) = $${params.length + 1}`;
            params.push(month);
        }

        if (type) {
            query += ` AND h.type = $${params.length + 1}`;
            params.push(type);
        }

        query += ` ORDER BY h.start_date`;

        const [holidays] = await pool.query(query, params);
        res.json(holidays);
    } catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ message: 'Server error while fetching holidays' });
    }
};

// Create holiday
const createHoliday = async (req, res) => {
    try {
        const {
            name,
            description,
            type,
            start_date,
            end_date,
            is_public_holiday
        } = req.body;

        // Check for date conflicts
        const [conflicts] = await pool.query(
            `SELECT * FROM holidays 
             WHERE (
                (start_date <= $1 AND end_date >= $1)
                OR (start_date <= $2 AND end_date >= $2)
                OR (start_date >= $1 AND end_date <= $2)
             )`,
            [start_date, end_date]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({
                message: 'Holiday dates conflict with existing holidays',
                conflicts
            });
        }

        const [holiday] = await pool.query(
            `INSERT INTO holidays (
                name, description, type, start_date,
                end_date, is_public_holiday
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [name, description, type, start_date, end_date, is_public_holiday]
        );

        res.status(201).json(holiday);
    } catch (error) {
        console.error('Error creating holiday:', error);
        res.status(500).json({ message: 'Server error while creating holiday' });
    }
};

// Update holiday
const updateHoliday = async (req, res) => {
    try {
        const { holiday_id } = req.params;
        const {
            name,
            description,
            type,
            start_date,
            end_date,
            is_public_holiday
        } = req.body;

        // Check for date conflicts excluding current holiday
        const [conflicts] = await pool.query(
            `SELECT * FROM holidays 
             WHERE id != $1
             AND (
                (start_date <= $2 AND end_date >= $2)
                OR (start_date <= $3 AND end_date >= $3)
                OR (start_date >= $2 AND end_date <= $3)
             )`,
            [holiday_id, start_date, end_date]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({
                message: 'Holiday dates conflict with existing holidays',
                conflicts
            });
        }

        const [holiday] = await pool.query(
            `UPDATE holidays 
             SET name = $1,
                 description = $2,
                 type = $3,
                 start_date = $4,
                 end_date = $5,
                 is_public_holiday = $6,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7
             RETURNING *`,
            [name, description, type, start_date, end_date, is_public_holiday, holiday_id]
        );

        if (!holiday.length) {
            return res.status(404).json({ message: 'Holiday not found' });
        }

        res.json(holiday[0]);
    } catch (error) {
        console.error('Error updating holiday:', error);
        res.status(500).json({ message: 'Server error while updating holiday' });
    }
};

// Delete holiday
const deleteHoliday = async (req, res) => {
    try {
        const { holiday_id } = req.params;

        const [holiday] = await pool.query(
            'DELETE FROM holidays WHERE id = $1 RETURNING *',
            [holiday_id]
        );

        if (!holiday.length) {
            return res.status(404).json({ message: 'Holiday not found' });
        }

        res.json({ message: 'Holiday deleted successfully' });
    } catch (error) {
        console.error('Error deleting holiday:', error);
        res.status(500).json({ message: 'Server error while deleting holiday' });
    }
};

// Get holiday calendar
const getHolidayCalendar = async (req, res) => {
    try {
        const { year, month } = req.query;
        let query = `
            SELECT 
                h.*,
                EXTRACT(DAY FROM h.start_date) as start_day,
                EXTRACT(DAY FROM h.end_date) as end_day,
                EXTRACT(MONTH FROM h.start_date) as start_month,
                EXTRACT(MONTH FROM h.end_date) as end_month,
                EXTRACT(YEAR FROM h.start_date) as start_year,
                EXTRACT(YEAR FROM h.end_date) as end_year
            FROM holidays h
            WHERE 1=1
        `;
        const params = [];

        if (year) {
            query += ` AND EXTRACT(YEAR FROM h.start_date) = $${params.length + 1}`;
            params.push(year);
        }

        if (month) {
            query += ` AND EXTRACT(MONTH FROM h.start_date) = $${params.length + 1}`;
            params.push(month);
        }

        query += ` ORDER BY h.start_date`;

        const [holidays] = await pool.query(query, params);
        res.json(holidays);
    } catch (error) {
        console.error('Error fetching holiday calendar:', error);
        res.status(500).json({ message: 'Server error while fetching holiday calendar' });
    }
};

// Get holiday statistics
const getHolidayStats = async (req, res) => {
    try {
        const { year } = req.query;
        let query = `
            SELECT 
                COUNT(*) as total_holidays,
                COUNT(DISTINCT CASE WHEN is_public_holiday THEN id END) as public_holidays,
                COUNT(DISTINCT CASE WHEN NOT is_public_holiday THEN id END) as school_holidays,
                COUNT(DISTINCT CASE WHEN type = 'festival' THEN id END) as festival_holidays,
                COUNT(DISTINCT CASE WHEN type = 'academic' THEN id END) as academic_holidays,
                COUNT(DISTINCT CASE WHEN type = 'emergency' THEN id END) as emergency_holidays,
                SUM(EXTRACT(DAY FROM (end_date - start_date + 1))) as total_holiday_days
            FROM holidays
            WHERE 1=1
        `;
        const params = [];

        if (year) {
            query += ` AND EXTRACT(YEAR FROM start_date) = $${params.length + 1}`;
            params.push(year);
        }

        const [stats] = await pool.query(query, params);

        // Get monthly distribution
        const [monthlyStats] = await pool.query(
            `SELECT 
                EXTRACT(MONTH FROM start_date) as month,
                COUNT(*) as total_holidays,
                SUM(EXTRACT(DAY FROM (end_date - start_date + 1))) as total_days
             FROM holidays
             WHERE 1=1
             ${year ? 'AND EXTRACT(YEAR FROM start_date) = $1' : ''}
             GROUP BY EXTRACT(MONTH FROM start_date)
             ORDER BY month`,
            year ? [year] : []
        );

        res.json({
            overall_stats: stats[0],
            monthly_stats: monthlyStats
        });
    } catch (error) {
        console.error('Error fetching holiday statistics:', error);
        res.status(500).json({ message: 'Server error while fetching holiday statistics' });
    }
};

module.exports = {
    getAllHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    getHolidayCalendar,
    getHolidayStats
}; 
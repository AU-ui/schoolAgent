const pool = require('../config/db');

// Get all fee types
const getFeeTypes = async (req, res) => {
    try {
        const [feeTypes] = await pool.query(
            'SELECT * FROM fee_types ORDER BY name'
        );
        res.json(feeTypes);
    } catch (error) {
        console.error('Error fetching fee types:', error);
        res.status(500).json({ message: 'Server error while fetching fee types' });
    }
};

// Get student fee details
const getStudentFees = async (req, res) => {
    try {
        const { student_id, academic_year, term } = req.query;

        const [feeDetails] = await pool.query(
            `SELECT 
                f.*,
                ft.name as fee_type,
                ft.description,
                p.payment_date,
                p.amount as paid_amount,
                p.payment_method,
                p.transaction_id,
                p.status as payment_status
             FROM fees f
             JOIN fee_types ft ON f.fee_type_id = ft.id
             LEFT JOIN payments p ON f.id = p.fee_id
             WHERE f.student_id = $1
             AND f.academic_year = $2
             ${term ? 'AND f.term = $3' : ''}
             ORDER BY f.due_date`,
            [student_id, academic_year, term].filter(Boolean)
        );

        // Calculate summary
        const summary = feeDetails.reduce((acc, fee) => {
            acc.total_amount += fee.amount;
            acc.paid_amount += fee.paid_amount || 0;
            acc.pending_amount += fee.amount - (fee.paid_amount || 0);
            return acc;
        }, { total_amount: 0, paid_amount: 0, pending_amount: 0 });

        res.json({
            fee_details: feeDetails,
            summary
        });
    } catch (error) {
        console.error('Error fetching student fees:', error);
        res.status(500).json({ message: 'Server error while fetching student fees' });
    }
};

// Create new fee record
const createFee = async (req, res) => {
    try {
        const {
            student_id,
            fee_type_id,
            amount,
            due_date,
            academic_year,
            term,
            description
        } = req.body;

        const [result] = await pool.query(
            `INSERT INTO fees (
                student_id, fee_type_id, amount, due_date, 
                academic_year, term, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [student_id, fee_type_id, amount, due_date, academic_year, term, description]
        );

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating fee record:', error);
        res.status(500).json({ message: 'Server error while creating fee record' });
    }
};

// Record fee payment
const recordPayment = async (req, res) => {
    try {
        const {
            fee_id,
            amount,
            payment_date,
            payment_method,
            transaction_id,
            status = 'completed',
            remarks
        } = req.body;

        // Start transaction
        await pool.query('BEGIN');

        // Record payment
        const [payment] = await pool.query(
            `INSERT INTO payments (
                fee_id, amount, payment_date, payment_method,
                transaction_id, status, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [fee_id, amount, payment_date, payment_method, transaction_id, status, remarks]
        );

        // Update fee status
        await pool.query(
            `UPDATE fees 
             SET status = CASE 
                WHEN amount <= $1 THEN 'paid'
                ELSE 'partial'
             END
             WHERE id = $2`,
            [amount, fee_id]
        );

        await pool.query('COMMIT');

        res.status(201).json(payment);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error recording payment:', error);
        res.status(500).json({ message: 'Server error while recording payment' });
    }
};

// Generate fee receipt
const generateFeeReceipt = async (req, res) => {
    try {
        const { payment_id } = req.params;

        const [receipt] = await pool.query(
            `SELECT 
                p.*,
                f.amount as fee_amount,
                f.due_date,
                f.academic_year,
                f.term,
                ft.name as fee_type,
                s.name as student_name,
                s.admission_number,
                c.name as class_name,
                c.section
             FROM payments p
             JOIN fees f ON p.fee_id = f.id
             JOIN fee_types ft ON f.fee_type_id = ft.id
             JOIN students s ON f.student_id = s.id
             JOIN classes c ON s.class_id = c.id
             WHERE p.id = $1`,
            [payment_id]
        );

        if (!receipt.length) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        res.json(receipt[0]);
    } catch (error) {
        console.error('Error generating fee receipt:', error);
        res.status(500).json({ message: 'Server error while generating fee receipt' });
    }
};

// Get fee payment history
const getPaymentHistory = async (req, res) => {
    try {
        const { student_id, start_date, end_date } = req.query;

        const [payments] = await pool.query(
            `SELECT 
                p.*,
                f.fee_type_id,
                ft.name as fee_type,
                f.academic_year,
                f.term
             FROM payments p
             JOIN fees f ON p.fee_id = f.id
             JOIN fee_types ft ON f.fee_type_id = ft.id
             WHERE f.student_id = $1
             AND p.payment_date BETWEEN $2 AND $3
             ORDER BY p.payment_date DESC`,
            [student_id, start_date, end_date]
        );

        res.json(payments);
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({ message: 'Server error while fetching payment history' });
    }
};

// Get fee defaulters
const getFeeDefaulters = async (req, res) => {
    try {
        const { class_id, due_date } = req.query;

        const [defaulters] = await pool.query(
            `SELECT 
                s.id as student_id,
                s.name as student_name,
                s.admission_number,
                c.name as class_name,
                c.section,
                COUNT(f.id) as pending_fees,
                SUM(f.amount) as total_pending_amount,
                MAX(f.due_date) as last_due_date
             FROM students s
             JOIN classes c ON s.class_id = c.id
             JOIN fees f ON s.id = f.student_id
             WHERE s.class_id = $1
             AND f.status != 'paid'
             AND f.due_date <= $2
             GROUP BY s.id, s.name, s.admission_number, c.name, c.section
             ORDER BY total_pending_amount DESC`,
            [class_id, due_date]
        );

        res.json(defaulters);
    } catch (error) {
        console.error('Error fetching fee defaulters:', error);
        res.status(500).json({ message: 'Server error while fetching fee defaulters' });
    }
};

// Generate fee collection report
const generateFeeCollectionReport = async (req, res) => {
    try {
        const { start_date, end_date, class_id } = req.query;

        const [report] = await pool.query(
            `SELECT 
                ft.name as fee_type,
                COUNT(DISTINCT f.id) as total_fees,
                SUM(f.amount) as total_amount,
                COUNT(DISTINCT p.id) as total_payments,
                SUM(p.amount) as collected_amount,
                COUNT(DISTINCT CASE WHEN f.status = 'paid' THEN f.id END) as fully_paid,
                COUNT(DISTINCT CASE WHEN f.status = 'partial' THEN f.id END) as partially_paid,
                COUNT(DISTINCT CASE WHEN f.status = 'pending' THEN f.id END) as pending
             FROM fees f
             JOIN fee_types ft ON f.fee_type_id = ft.id
             LEFT JOIN payments p ON f.id = p.fee_id
             JOIN students s ON f.student_id = s.id
             WHERE f.due_date BETWEEN $1 AND $2
             ${class_id ? 'AND s.class_id = $3' : ''}
             GROUP BY ft.id, ft.name
             ORDER BY ft.name`,
            [start_date, end_date, class_id].filter(Boolean)
        );

        // Calculate summary
        const summary = report.reduce((acc, row) => {
            acc.total_fees += row.total_fees;
            acc.total_amount += row.total_amount;
            acc.collected_amount += row.collected_amount;
            acc.pending_amount += (row.total_amount - row.collected_amount);
            return acc;
        }, {
            total_fees: 0,
            total_amount: 0,
            collected_amount: 0,
            pending_amount: 0
        });

        res.json({
            fee_type_wise: report,
            summary
        });
    } catch (error) {
        console.error('Error generating fee collection report:', error);
        res.status(500).json({ message: 'Server error while generating fee collection report' });
    }
};

module.exports = {
    getFeeTypes,
    getStudentFees,
    createFee,
    recordPayment,
    generateFeeReceipt,
    getPaymentHistory,
    getFeeDefaulters,
    generateFeeCollectionReport
}; 
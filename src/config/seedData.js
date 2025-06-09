const pool = require('./db');
const bcrypt = require('bcrypt');

const seedData = async () => {
    try {
        // Create sample users (teachers and parents)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        // Insert teachers
        const teachers = await pool.query(`
            INSERT INTO users (name, email, password, role) VALUES
            ('John Smith', 'john.smith@school.com', $1, 'teacher'),
            ('Sarah Johnson', 'sarah.j@school.com', $1, 'teacher'),
            ('Michael Brown', 'michael.b@school.com', $1, 'teacher')
            RETURNING id
        `, [hashedPassword]);

        // Insert parents
        const parents = await pool.query(`
            INSERT INTO users (name, email, password, role) VALUES
            ('David Wilson', 'david.w@email.com', $1, 'parent'),
            ('Emma Davis', 'emma.d@email.com', $1, 'parent'),
            ('Robert Taylor', 'robert.t@email.com', $1, 'parent')
            RETURNING id
        `, [hashedPassword]);

        // Insert sample tasks for teachers
        await pool.query(`
            INSERT INTO teacher_tasks (teacher_id, title, description, priority, due_date, status) VALUES
            ($1, 'Grade Math Tests', 'Grade the latest batch of math tests', 'high', '2024-03-15', 'pending'),
            ($1, 'Parent Meeting', 'Prepare for parent-teacher meeting', 'medium', '2024-03-20', 'completed'),
            ($2, 'Update Lesson Plans', 'Update science lesson plans for next week', 'high', '2024-03-18', 'pending'),
            ($2, 'Science Project Review', 'Review student science projects', 'medium', '2024-03-25', 'pending'),
            ($3, 'Sports Day Preparation', 'Prepare for annual sports day', 'low', '2024-04-01', 'pending')
        `, [teachers.rows[0].id]);

        // Insert sample messages between teachers and parents
        await pool.query(`
            INSERT INTO parent_messages (teacher_id, parent_id, message, status) VALUES
            ($1, $2, 'Hello Mr. Wilson, I would like to discuss your child\'s progress in mathematics.', 'sent'),
            ($2, $3, 'Ms. Davis, your child has shown great improvement in science projects.', 'sent'),
            ($3, $4, 'Mr. Taylor, regarding the upcoming sports day participation.', 'sent'),
            ($1, $3, 'Ms. Davis, please check the latest homework assignment.', 'sent'),
            ($2, $4, 'Mr. Taylor, your child\'s science project was excellent!', 'sent')
        `, [teachers.rows[0].id, parents.rows[0].id]);

        console.log('Sample data inserted successfully!');
        
        // Print sample data for verification
        console.log('\nSample Teachers:');
        const teacherList = await pool.query('SELECT id, name, email, role FROM users WHERE role = \'teacher\'');
        console.log(teacherList.rows);

        console.log('\nSample Parents:');
        const parentList = await pool.query('SELECT id, name, email, role FROM users WHERE role = \'parent\'');
        console.log(parentList.rows);

        console.log('\nSample Tasks:');
        const taskList = await pool.query('SELECT * FROM teacher_tasks');
        console.log(taskList.rows);

        console.log('\nSample Messages:');
        const messageList = await pool.query(`
            SELECT m.*, t.name as teacher_name, p.name as parent_name 
            FROM parent_messages m 
            JOIN users t ON m.teacher_id = t.id 
            JOIN users p ON m.parent_id = p.id
        `);
        console.log(messageList.rows);

    } catch (error) {
        console.error('Error seeding data:', error);
    }
};

// Run the seed function
seedData(); 
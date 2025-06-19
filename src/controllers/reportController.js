const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const docx = require('docx');
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = docx;

// Generate academic report
const generateAcademicReport = async (req, res) => {
    try {
        const { student_id, class_id, term } = req.query;
        const { format = 'pdf' } = req.query;

        // Get student details with additional information
        const [studentDetails] = await pool.query(
            `SELECT 
                s.*, 
                c.name as class_name,
                c.section,
                p.name as parent_name,
                p.email as parent_email,
                p.phone as parent_phone,
                s.admission_number,
                s.date_of_birth,
                s.gender,
                s.blood_group,
                s.address
             FROM students s
             JOIN classes c ON s.class_id = c.id
             JOIN users p ON s.parent_id = p.id
             WHERE s.id = $1`,
            [student_id]
        );

        if (!studentDetails.length) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Get academic performance with enhanced ranking calculations
        const [academicPerformance] = await pool.query(
            `WITH student_ranks AS (
                SELECT 
                    er.student_id,
                    e.subject_id,
                    e.id as exam_id,
                    er.marks_obtained,
                    RANK() OVER (PARTITION BY e.id ORDER BY er.marks_obtained DESC) as exam_rank,
                    COUNT(*) OVER (PARTITION BY e.id) as total_students,
                    ROUND((er.marks_obtained::float / e.total_marks::float) * 100, 2) as percentage
                FROM exam_results er
                JOIN exams e ON er.exam_id = e.id
                WHERE e.class_id = $2
                ${term ? 'AND e.exam_type = $3' : ''}
            ),
            overall_ranks AS (
                SELECT 
                    student_id,
                    ROUND(AVG(percentage), 2) as overall_percentage,
                    RANK() OVER (ORDER BY AVG(percentage) DESC) as overall_rank,
                    COUNT(*) OVER () as total_class_students
                FROM student_ranks
                GROUP BY student_id
            ),
            subject_percentiles AS (
                SELECT 
                    student_id,
                    subject_id,
                    ROUND(AVG(percentage), 2) as subject_percentage,
                    PERCENT_RANK() OVER (PARTITION BY subject_id ORDER BY AVG(percentage)) * 100 as subject_percentile
                FROM student_ranks
                GROUP BY student_id, subject_id
            ),
            rank_progress AS (
                SELECT 
                    student_id,
                    subject_id,
                    exam_id,
                    exam_rank,
                    LAG(exam_rank) OVER (PARTITION BY student_id, subject_id ORDER BY exam_id) as previous_rank,
                    exam_rank - LAG(exam_rank) OVER (PARTITION BY student_id, subject_id ORDER BY exam_id) as rank_change
                FROM student_ranks
            )
            SELECT 
                s.name as subject_name,
                s.code as subject_code,
                COUNT(DISTINCT e.id) as total_exams,
                ROUND(AVG(er.marks_obtained), 2) as average_marks,
                MAX(er.marks_obtained) as highest_marks,
                MIN(er.marks_obtained) as lowest_marks,
                COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END) as exams_passed,
                COUNT(CASE WHEN er.marks_obtained < e.passing_marks THEN 1 END) as exams_failed,
                CASE 
                    WHEN AVG(er.marks_obtained) >= 90 THEN 'A+'
                    WHEN AVG(er.marks_obtained) >= 80 THEN 'A'
                    WHEN AVG(er.marks_obtained) >= 70 THEN 'B+'
                    WHEN AVG(er.marks_obtained) >= 60 THEN 'B'
                    WHEN AVG(er.marks_obtained) >= 50 THEN 'C'
                    WHEN AVG(er.marks_obtained) >= 40 THEN 'D'
                    ELSE 'F'
                END as grade,
                json_agg(
                    json_build_object(
                        'exam_id', e.id,
                        'exam_name', e.name,
                        'marks', er.marks_obtained,
                        'rank', sr.exam_rank,
                        'total_students', sr.total_students,
                        'percentage', sr.percentage,
                        'rank_change', rp.rank_change,
                        'previous_rank', rp.previous_rank
                    )
                ) as exam_details,
                sp.subject_percentile,
                or.overall_rank,
                or.overall_percentage,
                or.total_class_students
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.id
            JOIN subjects s ON e.subject_id = s.id
            JOIN student_ranks sr ON er.student_id = sr.student_id AND e.id = sr.exam_id
            JOIN rank_progress rp ON er.student_id = rp.student_id AND e.id = rp.exam_id
            JOIN subject_percentiles sp ON er.student_id = sp.student_id AND e.subject_id = sp.subject_id
            JOIN overall_ranks or ON er.student_id = or.student_id
            WHERE er.student_id = $1
            AND e.class_id = $2
            ${term ? 'AND e.exam_type = $3' : ''}
            GROUP BY s.id, s.name, s.code, sp.subject_percentile, or.overall_rank, or.overall_percentage, or.total_class_students
            ORDER BY s.name`,
            [student_id, class_id, term].filter(Boolean)
        );

        // Get attendance statistics with monthly breakdown
        const [attendanceStats] = await pool.query(
            `SELECT 
                COUNT(*) as total_days,
                COUNT(CASE WHEN status = 'present' THEN 1 END) as days_present,
                COUNT(CASE WHEN status = 'absent' THEN 1 END) as days_absent,
                COUNT(CASE WHEN status = 'late' THEN 1 END) as days_late,
                ROUND((COUNT(CASE WHEN status = 'present' THEN 1 END)::float / COUNT(*)::float) * 100, 2) as attendance_percentage,
                json_agg(
                    json_build_object(
                        'month', to_char(date, 'Month YYYY'),
                        'present', COUNT(CASE WHEN status = 'present' THEN 1 END),
                        'absent', COUNT(CASE WHEN status = 'absent' THEN 1 END),
                        'late', COUNT(CASE WHEN status = 'late' THEN 1 END)
                    )
                ) as monthly_stats
             FROM attendance
             WHERE student_id = $1
             AND class_id = $2
             ${term ? 'AND date BETWEEN $3 AND $4' : ''}
             GROUP BY student_id, class_id`,
            [student_id, class_id, term ? term.start_date : null, term ? term.end_date : null].filter(Boolean)
        );

        // Get teacher remarks with subject-wise performance analysis
        const [teacherRemarks] = await pool.query(
            `SELECT 
                t.name as teacher_name,
                s.name as subject_name,
                r.remarks,
                r.created_at,
                r.strengths,
                r.weaknesses,
                r.recommendations
             FROM teacher_remarks r
             JOIN users t ON r.teacher_id = t.id
             JOIN subjects s ON r.subject_id = s.id
             WHERE r.student_id = $1
             AND r.class_id = $2
             ${term ? 'AND r.term = $3' : ''}
             ORDER BY r.created_at DESC`,
            [student_id, class_id, term].filter(Boolean)
        );

        // Get co-curricular activities
        const [activities] = await pool.query(
            `SELECT 
                a.name as activity_name,
                a.type as activity_type,
                a.position,
                a.achievement_date,
                a.description
             FROM student_activities a
             WHERE a.student_id = $1
             AND a.class_id = $2
             ${term ? 'AND a.achievement_date BETWEEN $3 AND $4' : ''}
             ORDER BY a.achievement_date DESC`,
            [student_id, class_id, term ? term.start_date : null, term ? term.end_date : null].filter(Boolean)
        );

        if (format === 'pdf') {
            // Create PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=academic_report_${student_id}.pdf`);

            // Pipe PDF to response
            doc.pipe(res);

            // Add school header
            doc.fontSize(24).text('SCHOOL NAME', { align: 'center' });
            doc.fontSize(16).text('Academic Progress Report', { align: 'center' });
            doc.moveDown();

            // Add student information
            doc.fontSize(14).text('Student Information', { underline: true });
            doc.moveDown();
            doc.fontSize(12).text(`Name: ${studentDetails[0].name}`);
            doc.fontSize(12).text(`Admission Number: ${studentDetails[0].admission_number}`);
            doc.fontSize(12).text(`Class: ${studentDetails[0].class_name} ${studentDetails[0].section}`);
            doc.fontSize(12).text(`Date of Birth: ${new Date(studentDetails[0].date_of_birth).toLocaleDateString()}`);
            doc.fontSize(12).text(`Gender: ${studentDetails[0].gender}`);
            doc.fontSize(12).text(`Blood Group: ${studentDetails[0].blood_group}`);
            doc.moveDown();

            // Add parent information
            doc.fontSize(14).text('Parent Information', { underline: true });
            doc.moveDown();
            doc.fontSize(12).text(`Parent Name: ${studentDetails[0].parent_name}`);
            doc.fontSize(12).text(`Email: ${studentDetails[0].parent_email}`);
            doc.fontSize(12).text(`Phone: ${studentDetails[0].parent_phone}`);
            doc.moveDown();

            // Add academic performance
            doc.fontSize(14).text('Academic Performance', { underline: true });
            doc.moveDown();

            // Create table for academic performance
            const tableTop = doc.y;
            const tableLeft = 50;
            const colWidth = (doc.page.width - 100) / 7;

            // Table headers
            doc.fontSize(10);
            doc.text('Subject', tableLeft, tableTop);
            doc.text('Code', tableLeft + colWidth, tableTop);
            doc.text('Avg Marks', tableLeft + colWidth * 2, tableTop);
            doc.text('Highest', tableLeft + colWidth * 3, tableTop);
            doc.text('Lowest', tableLeft + colWidth * 4, tableTop);
            doc.text('Grade', tableLeft + colWidth * 5, tableTop);
            doc.text('Pass/Fail', tableLeft + colWidth * 6, tableTop);

            // Table rows
            let y = tableTop + 20;
            academicPerformance.forEach(subject => {
                doc.text(subject.subject_name, tableLeft, y);
                doc.text(subject.subject_code, tableLeft + colWidth, y);
                doc.text(subject.average_marks.toString(), tableLeft + colWidth * 2, y);
                doc.text(subject.highest_marks.toString(), tableLeft + colWidth * 3, y);
                doc.text(subject.lowest_marks.toString(), tableLeft + colWidth * 4, y);
                doc.text(subject.grade, tableLeft + colWidth * 5, y);
                doc.text(`${subject.exams_passed}/${subject.total_exams}`, tableLeft + colWidth * 6, y);
                y += 20;
            });
            doc.moveDown(y - tableTop + 20);

            // Add overall performance summary
            doc.fontSize(14).text('Overall Performance Summary', { underline: true });
            doc.moveDown();
            doc.fontSize(12).text(`Overall Class Rank: ${academicPerformance[0].overall_rank} out of ${academicPerformance[0].total_class_students} students`);
            doc.fontSize(12).text(`Overall Percentage: ${academicPerformance[0].overall_percentage}%`);
            doc.moveDown();

            // Add subject-wise performance with ranks and percentiles
            doc.fontSize(14).text('Detailed Subject Performance', { underline: true });
            doc.moveDown();

            academicPerformance.forEach(subject => {
                doc.fontSize(12).text(`Subject: ${subject.subject_name}`, { underline: true });
                doc.fontSize(10).text(`Subject Percentile: ${subject.subject_percentile.toFixed(2)}%`);
                doc.moveDown();

                const examDetails = JSON.parse(subject.exam_details);
                examDetails.forEach(exam => {
                    doc.fontSize(10).text(`Exam: ${exam.exam_name}`);
                    doc.fontSize(10).text(`Marks: ${exam.marks} (${exam.percentage}%)`);
                    doc.fontSize(10).text(`Rank: ${exam.rank} out of ${exam.total_students} students`);
                    if (exam.rank_change) {
                        const change = exam.rank_change;
                        const direction = change < 0 ? 'improved' : change > 0 ? 'declined' : 'unchanged';
                        doc.fontSize(10).text(`Rank Change: ${Math.abs(change)} positions ${direction}`);
                    }
                    doc.moveDown();
                });
            });

            // Add attendance statistics
            doc.fontSize(14).text('Attendance Statistics', { underline: true });
            doc.moveDown();
            doc.fontSize(12).text(`Total Days: ${attendanceStats[0].total_days}`);
            doc.fontSize(12).text(`Days Present: ${attendanceStats[0].days_present}`);
            doc.fontSize(12).text(`Days Absent: ${attendanceStats[0].days_absent}`);
            doc.fontSize(12).text(`Days Late: ${attendanceStats[0].days_late}`);
            doc.fontSize(12).text(`Attendance Percentage: ${attendanceStats[0].attendance_percentage}%`);
            doc.moveDown();

            // Add monthly attendance breakdown
            doc.fontSize(14).text('Monthly Attendance Breakdown', { underline: true });
            doc.moveDown();
            const monthlyStats = JSON.parse(attendanceStats[0].monthly_stats);
            monthlyStats.forEach(month => {
                doc.fontSize(12).text(month.month);
                doc.fontSize(10).text(`Present: ${month.present}, Absent: ${month.absent}, Late: ${month.late}`);
                doc.moveDown();
            });

            // Add teacher remarks
            doc.fontSize(14).text('Teacher Remarks', { underline: true });
            doc.moveDown();

            teacherRemarks.forEach(remark => {
                doc.fontSize(12).text(`Subject: ${remark.subject_name}`);
                doc.fontSize(10).text(`Teacher: ${remark.teacher_name}`);
                doc.fontSize(10).text(`Remarks: ${remark.remarks}`);
                if (remark.strengths) {
                    doc.fontSize(10).text(`Strengths: ${remark.strengths}`);
                }
                if (remark.weaknesses) {
                    doc.fontSize(10).text(`Areas for Improvement: ${remark.weaknesses}`);
                }
                if (remark.recommendations) {
                    doc.fontSize(10).text(`Recommendations: ${remark.recommendations}`);
                }
                doc.fontSize(10).text(`Date: ${new Date(remark.created_at).toLocaleDateString()}`);
                doc.moveDown();
            });

            // Add co-curricular activities
            if (activities.length > 0) {
                doc.fontSize(14).text('Co-curricular Activities', { underline: true });
                doc.moveDown();

                activities.forEach(activity => {
                    doc.fontSize(12).text(`Activity: ${activity.activity_name}`);
                    doc.fontSize(10).text(`Type: ${activity.activity_type}`);
                    if (activity.position) {
                        doc.fontSize(10).text(`Position: ${activity.position}`);
                    }
                    doc.fontSize(10).text(`Date: ${new Date(activity.achievement_date).toLocaleDateString()}`);
                    if (activity.description) {
                        doc.fontSize(10).text(`Description: ${activity.description}`);
                    }
                    doc.moveDown();
                });
            }

            // Add footer
            const footerText = `Generated on ${new Date().toLocaleDateString()}`;
            doc.fontSize(10).text(footerText, 50, doc.page.height - 50, { align: 'center' });

            // Finalize PDF
            doc.end();
        } else if (format === 'docx') {
            // Create DOCX document with enhanced formatting
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        // School Header
                        new Paragraph({
                            text: 'SCHOOL NAME',
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: 'Academic Progress Report',
                            heading: HeadingLevel.HEADING_2,
                            alignment: AlignmentType.CENTER
                        }),

                        // Student Information
                        new Paragraph({
                            text: 'Student Information',
                            heading: HeadingLevel.HEADING_2
                        }),
                        new Paragraph({
                            text: `Name: ${studentDetails[0].name}`
                        }),
                        new Paragraph({
                            text: `Admission Number: ${studentDetails[0].admission_number}`
                        }),
                        new Paragraph({
                            text: `Class: ${studentDetails[0].class_name} ${studentDetails[0].section}`
                        }),
                        new Paragraph({
                            text: `Date of Birth: ${new Date(studentDetails[0].date_of_birth).toLocaleDateString()}`
                        }),
                        new Paragraph({
                            text: `Gender: ${studentDetails[0].gender}`
                        }),
                        new Paragraph({
                            text: `Blood Group: ${studentDetails[0].blood_group}`
                        }),

                        // Parent Information
                        new Paragraph({
                            text: 'Parent Information',
                            heading: HeadingLevel.HEADING_2
                        }),
                        new Paragraph({
                            text: `Parent Name: ${studentDetails[0].parent_name}`
                        }),
                        new Paragraph({
                            text: `Email: ${studentDetails[0].parent_email}`
                        }),
                        new Paragraph({
                            text: `Phone: ${studentDetails[0].parent_phone}`
                        }),

                        // Academic Performance Table
                        new Paragraph({
                            text: 'Academic Performance',
                            heading: HeadingLevel.HEADING_2
                        }),
                        new Table({
                            width: {
                                size: 100,
                                type: WidthType.PERCENTAGE,
                            },
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph('Subject')] }),
                                        new TableCell({ children: [new Paragraph('Code')] }),
                                        new TableCell({ children: [new Paragraph('Avg Marks')] }),
                                        new TableCell({ children: [new Paragraph('Highest')] }),
                                        new TableCell({ children: [new Paragraph('Lowest')] }),
                                        new TableCell({ children: [new Paragraph('Grade')] }),
                                        new TableCell({ children: [new Paragraph('Pass/Fail')] })
                                    ]
                                }),
                                ...academicPerformance.map(subject => new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph(subject.subject_name)] }),
                                        new TableCell({ children: [new Paragraph(subject.subject_code)] }),
                                        new TableCell({ children: [new Paragraph(subject.average_marks.toString())] }),
                                        new TableCell({ children: [new Paragraph(subject.highest_marks.toString())] }),
                                        new TableCell({ children: [new Paragraph(subject.lowest_marks.toString())] }),
                                        new TableCell({ children: [new Paragraph(subject.grade)] }),
                                        new TableCell({ children: [new Paragraph(`${subject.exams_passed}/${subject.total_exams}`)] })
                                    ]
                                }))
                            ]
                        }),

                        // Overall Performance Summary
                        new Paragraph({
                            text: 'Overall Performance Summary',
                            heading: HeadingLevel.HEADING_2
                        }),
                        new Paragraph({
                            text: `Overall Class Rank: ${academicPerformance[0].overall_rank} out of ${academicPerformance[0].total_class_students} students`
                        }),
                        new Paragraph({
                            text: `Overall Percentage: ${academicPerformance[0].overall_percentage}%`
                        }),

                        // Detailed Subject Performance
                        new Paragraph({
                            text: 'Detailed Subject Performance',
                            heading: HeadingLevel.HEADING_2
                        }),
                        ...academicPerformance.flatMap(subject => [
                            new Paragraph({
                                text: `Subject: ${subject.subject_name}`,
                                bold: true
                            }),
                            new Paragraph({
                                text: `Subject Percentile: ${subject.subject_percentile.toFixed(2)}%`
                            }),
                            ...JSON.parse(subject.exam_details).flatMap(exam => [
                                new Paragraph({
                                    text: `Exam: ${exam.exam_name}`
                                }),
                                new Paragraph({
                                    text: `Marks: ${exam.marks} (${exam.percentage}%)`
                                }),
                                new Paragraph({
                                    text: `Rank: ${exam.rank} out of ${exam.total_students} students`
                                }),
                                ...(exam.rank_change ? [new Paragraph({
                                    text: `Rank Change: ${Math.abs(exam.rank_change)} positions ${
                                        exam.rank_change < 0 ? 'improved' : 
                                        exam.rank_change > 0 ? 'declined' : 
                                        'unchanged'
                                    }`
                                })] : [])
                            ])
                        ]),

                        // Attendance Statistics
                        new Paragraph({
                            text: 'Attendance Statistics',
                            heading: HeadingLevel.HEADING_2
                        }),
                        new Paragraph({
                            text: `Total Days: ${attendanceStats[0].total_days}`
                        }),
                        new Paragraph({
                            text: `Days Present: ${attendanceStats[0].days_present}`
                        }),
                        new Paragraph({
                            text: `Days Absent: ${attendanceStats[0].days_absent}`
                        }),
                        new Paragraph({
                            text: `Days Late: ${attendanceStats[0].days_late}`
                        }),
                        new Paragraph({
                            text: `Attendance Percentage: ${attendanceStats[0].attendance_percentage}%`
                        }),

                        // Monthly Attendance Breakdown
                        new Paragraph({
                            text: 'Monthly Attendance Breakdown',
                            heading: HeadingLevel.HEADING_2
                        }),
                        ...JSON.parse(attendanceStats[0].monthly_stats).flatMap(month => [
                            new Paragraph({
                                text: month.month,
                                bold: true
                            }),
                            new Paragraph({
                                text: `Present: ${month.present}, Absent: ${month.absent}, Late: ${month.late}`
                            })
                        ]),

                        // Teacher Remarks
                        new Paragraph({
                            text: 'Teacher Remarks',
                            heading: HeadingLevel.HEADING_2
                        }),
                        ...teacherRemarks.flatMap(remark => [
                            new Paragraph({
                                text: `Subject: ${remark.subject_name}`,
                                bold: true
                            }),
                            new Paragraph({
                                text: `Teacher: ${remark.teacher_name}`
                            }),
                            new Paragraph({
                                text: `Remarks: ${remark.remarks}`
                            }),
                            ...(remark.strengths ? [new Paragraph({
                                text: `Strengths: ${remark.strengths}`
                            })] : []),
                            ...(remark.weaknesses ? [new Paragraph({
                                text: `Areas for Improvement: ${remark.weaknesses}`
                            })] : []),
                            ...(remark.recommendations ? [new Paragraph({
                                text: `Recommendations: ${remark.recommendations}`
                            })] : []),
                            new Paragraph({
                                text: `Date: ${new Date(remark.created_at).toLocaleDateString()}`
                            })
                        ]),

                        // Co-curricular Activities
                        ...(activities.length > 0 ? [
                            new Paragraph({
                                text: 'Co-curricular Activities',
                                heading: HeadingLevel.HEADING_2
                            }),
                            ...activities.flatMap(activity => [
                                new Paragraph({
                                    text: `Activity: ${activity.activity_name}`,
                                    bold: true
                                }),
                                new Paragraph({
                                    text: `Type: ${activity.activity_type}`
                                }),
                                ...(activity.position ? [new Paragraph({
                                    text: `Position: ${activity.position}`
                                })] : []),
                                new Paragraph({
                                    text: `Date: ${new Date(activity.achievement_date).toLocaleDateString()}`
                                }),
                                ...(activity.description ? [new Paragraph({
                                    text: `Description: ${activity.description}`
                                })] : [])
                            ])
                        ] : []),

                        // Footer
                        new Paragraph({
                            text: `Generated on ${new Date().toLocaleDateString()}`,
                            alignment: AlignmentType.CENTER
                        })
                    ]
                }]
            });

            // Generate DOCX buffer
            const buffer = await docx.Packer.toBuffer(doc);

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=academic_report_${student_id}.docx`);

            // Send DOCX file
            res.send(buffer);
        } else {
            return res.status(400).json({ message: 'Invalid format. Supported formats: pdf, docx' });
        }
    } catch (error) {
        console.error('Error generating academic report:', error);
        res.status(500).json({ message: 'Server error while generating report' });
    }
};

// Generate attendance report
const generateAttendanceReport = async (req, res) => {
    try {
        const { class_id, start_date, end_date } = req.query;
        const { format = 'pdf' } = req.query;

        // Get class details
        const [classDetails] = await pool.query(
            'SELECT name FROM classes WHERE id = $1',
            [class_id]
        );

        if (!classDetails.length) {
            return res.status(404).json({ message: 'Class not found' });
        }

        // Get attendance data
        const [attendanceData] = await pool.query(
            `SELECT 
                s.name as student_name,
                s.roll_number,
                COUNT(*) as total_days,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END) as days_present,
                COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as days_absent,
                COUNT(CASE WHEN a.status = 'late' THEN 1 END) as days_late,
                ROUND((COUNT(CASE WHEN a.status = 'present' THEN 1 END)::float / COUNT(*)::float) * 100, 2) as attendance_percentage
             FROM attendance a
             JOIN students s ON a.student_id = s.id
             WHERE a.class_id = $1
             AND a.date BETWEEN $2 AND $3
             GROUP BY s.id, s.name, s.roll_number
             ORDER BY s.roll_number`,
            [class_id, start_date, end_date]
        );

        if (format === 'pdf') {
            // Create PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${class_id}.pdf`);

            // Pipe PDF to response
            doc.pipe(res);

            // Add header
            doc.fontSize(20).text('Attendance Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(16).text(`Class: ${classDetails[0].name}`, { align: 'center' });
            doc.fontSize(16).text(`Period: ${start_date} to ${end_date}`, { align: 'center' });
            doc.moveDown();

            // Add attendance data
            doc.fontSize(12).text('Student Attendance Summary', { underline: true });
            doc.moveDown();

            attendanceData.forEach(student => {
                doc.fontSize(10).text(`Student: ${student.student_name} (Roll No: ${student.roll_number})`);
                doc.fontSize(10).text(`Total Days: ${student.total_days}`);
                doc.fontSize(10).text(`Days Present: ${student.days_present}`);
                doc.fontSize(10).text(`Days Absent: ${student.days_absent}`);
                doc.fontSize(10).text(`Days Late: ${student.days_late}`);
                doc.fontSize(10).text(`Attendance Percentage: ${student.attendance_percentage}%`);
                doc.moveDown();
            });

            // Finalize PDF
            doc.end();
        } else if (format === 'docx') {
            // Create DOCX document
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            text: 'Attendance Report',
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: `Class: ${classDetails[0].name}`,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: `Period: ${start_date} to ${end_date}`,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: 'Student Attendance Summary',
                            heading: HeadingLevel.HEADING_2
                        }),
                        ...attendanceData.flatMap(student => [
                            new Paragraph({
                                text: `Student: ${student.student_name} (Roll No: ${student.roll_number})`,
                                bold: true
                            }),
                            new Paragraph({
                                text: `Total Days: ${student.total_days}`
                            }),
                            new Paragraph({
                                text: `Days Present: ${student.days_present}`
                            }),
                            new Paragraph({
                                text: `Days Absent: ${student.days_absent}`
                            }),
                            new Paragraph({
                                text: `Days Late: ${student.days_late}`
                            }),
                            new Paragraph({
                                text: `Attendance Percentage: ${student.attendance_percentage}%`
                            })
                        ])
                    ]
                }]
            });

            // Generate DOCX buffer
            const buffer = await docx.Packer.toBuffer(doc);

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${class_id}.docx`);

            // Send DOCX file
            res.send(buffer);
        } else {
            return res.status(400).json({ message: 'Invalid format. Supported formats: pdf, docx' });
        }
    } catch (error) {
        console.error('Error generating attendance report:', error);
        res.status(500).json({ message: 'Server error while generating report' });
    }
};

// Generate performance report
const generatePerformanceReport = async (req, res) => {
    try {
        const { class_id, subject_id, exam_type } = req.query;
        const { format = 'pdf' } = req.query;

        // Get class and subject details
        const [details] = await pool.query(
            `SELECT c.name as class_name, s.name as subject_name
             FROM classes c, subjects s
             WHERE c.id = $1 AND s.id = $2`,
            [class_id, subject_id]
        );

        if (!details.length) {
            return res.status(404).json({ message: 'Class or subject not found' });
        }

        // Get performance data
        const [performanceData] = await pool.query(
            `SELECT 
                s.name as student_name,
                s.roll_number,
                COUNT(DISTINCT e.id) as total_exams,
                ROUND(AVG(er.marks_obtained), 2) as average_marks,
                MAX(er.marks_obtained) as highest_marks,
                MIN(er.marks_obtained) as lowest_marks,
                COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END) as exams_passed,
                COUNT(CASE WHEN er.marks_obtained < e.passing_marks THEN 1 END) as exams_failed,
                ROUND((COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END)::float / 
                    COUNT(DISTINCT e.id)::float) * 100, 2) as pass_percentage
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.id
             JOIN students s ON er.student_id = s.id
             WHERE e.class_id = $1
             AND e.subject_id = $2
             ${exam_type ? 'AND e.exam_type = $3' : ''}
             GROUP BY s.id, s.name, s.roll_number
             ORDER BY average_marks DESC`,
            [class_id, subject_id, exam_type].filter(Boolean)
        );

        if (format === 'pdf') {
            // Create PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=performance_report_${class_id}_${subject_id}.pdf`);

            // Pipe PDF to response
            doc.pipe(res);

            // Add header
            doc.fontSize(20).text('Performance Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(16).text(`Class: ${details[0].class_name}`, { align: 'center' });
            doc.fontSize(16).text(`Subject: ${details[0].subject_name}`, { align: 'center' });
            doc.fontSize(16).text(`Exam Type: ${exam_type || 'All Types'}`, { align: 'center' });
            doc.moveDown();

            // Add performance data
            doc.fontSize(12).text('Student Performance Summary', { underline: true });
            doc.moveDown();

            performanceData.forEach(student => {
                doc.fontSize(10).text(`Student: ${student.student_name} (Roll No: ${student.roll_number})`);
                doc.fontSize(10).text(`Average Marks: ${student.average_marks}`);
                doc.fontSize(10).text(`Highest Marks: ${student.highest_marks}`);
                doc.fontSize(10).text(`Lowest Marks: ${student.lowest_marks}`);
                doc.fontSize(10).text(`Exams Passed: ${student.exams_passed}/${student.total_exams}`);
                doc.fontSize(10).text(`Pass Percentage: ${student.pass_percentage}%`);
                doc.moveDown();
            });

            // Finalize PDF
            doc.end();
        } else if (format === 'docx') {
            // Create DOCX document
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            text: 'Performance Report',
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: `Class: ${details[0].class_name}`,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: `Subject: ${details[0].subject_name}`,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: `Exam Type: ${exam_type || 'All Types'}`,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({
                            text: 'Student Performance Summary',
                            heading: HeadingLevel.HEADING_2
                        }),
                        ...performanceData.flatMap(student => [
                            new Paragraph({
                                text: `Student: ${student.student_name} (Roll No: ${student.roll_number})`,
                                bold: true
                            }),
                            new Paragraph({
                                text: `Average Marks: ${student.average_marks}`
                            }),
                            new Paragraph({
                                text: `Highest Marks: ${student.highest_marks}`
                            }),
                            new Paragraph({
                                text: `Lowest Marks: ${student.lowest_marks}`
                            }),
                            new Paragraph({
                                text: `Exams Passed: ${student.exams_passed}/${student.total_exams}`
                            }),
                            new Paragraph({
                                text: `Pass Percentage: ${student.pass_percentage}%`
                            })
                        ])
                    ]
                }]
            });

            // Generate DOCX buffer
            const buffer = await docx.Packer.toBuffer(doc);

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=performance_report_${class_id}_${subject_id}.docx`);

            // Send DOCX file
            res.send(buffer);
        } else {
            return res.status(400).json({ message: 'Invalid format. Supported formats: pdf, docx' });
        }
    } catch (error) {
        console.error('Error generating performance report:', error);
        res.status(500).json({ message: 'Server error while generating report' });
    }
};

module.exports = {
    generateAcademicReport,
    generateAttendanceReport,
    generatePerformanceReport
}; 
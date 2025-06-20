const request = require('supertest');
const express = require('express');
const mlRoutes = require('../routes/mlRoutes');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/ml', mlRoutes);

describe('ML Routes', () => {
    // Test student performance prediction
    test('POST /api/ml/predict-performance - should predict student performance', async () => {
        const response = await request(app)
            .post('/predict-performance')
            .send({
                grades: [85, 90, 88, 92, 87]
            });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('prediction');
        expect(response.body).toHaveProperty('average');
    });

    // Test attendance anomaly detection
    test('POST /api/ml/attendance-anomaly - should detect attendance anomalies', async () => {
        const response = await request(app)
            .post('/attendance-anomaly')
            .send({
                attendance: [0.8, 0.9, 0.7, 0.6, 0.8]
            });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('attendance_rate');
    });

    // Test message classification
    test('POST /api/ml/classify-message - should classify messages', async () => {
        const response = await request(app)
            .post('/classify-message')
            .send({
                message: 'Urgent: Please submit your assignment immediately'
            });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('label');
    });

    // Test error handling
    test('POST /api/ml/predict-performance - should handle empty grades', async () => {
        const response = await request(app)
            .post('/predict-performance')
            .send({
                grades: []
            });
        
        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
    });
});

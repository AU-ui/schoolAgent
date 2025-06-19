const express = require('express');
const router = express.Router();
const axios = require('axios');

// POST /api/ml/predict
router.post('/predict', async (req, res) => {
    const { grades } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/predict', { grades });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/predict-performance
router.post('/predict-performance', async (req, res) => {
    const { grades } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/predict-performance', { grades });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/attendance-anomaly
router.post('/attendance-anomaly', async (req, res) => {
    const { attendance } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/attendance-anomaly', { attendance });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/classify-message
router.post('/classify-message', async (req, res) => {
    const { message } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/classify-message', { message });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/recommend-book
router.post('/recommend-book', async (req, res) => {
    const { borrowed } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/recommend-book', { borrowed });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/predict-event-participation
router.post('/predict-event-participation', async (req, res) => {
    const { category, past_participation } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/predict-event-participation', { category, past_participation });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/analyze-complaint-sentiment
router.post('/analyze-complaint-sentiment', async (req, res) => {
    const { complaint } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/analyze-complaint-sentiment', { complaint });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/optimize-transport-route
router.post('/optimize-transport-route', async (req, res) => {
    const { stops } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/optimize-transport-route', { stops });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/predict-fee-default
router.post('/predict-fee-default', async (req, res) => {
    const { payment_history } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/predict-fee-default', { payment_history });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/detect-timetable-conflicts
router.post('/detect-timetable-conflicts', async (req, res) => {
    const { entries } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/detect-timetable-conflicts', { entries });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/predict-dropout-risk
router.post('/predict-dropout-risk', async (req, res) => {
    const { grades, attendance } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/predict-dropout-risk', { grades, attendance });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ml/recommend-learning-path
router.post('/recommend-learning-path', async (req, res) => {
    const { grades, interests } = req.body;
    try {
        const response = await axios.post('http://localhost:5000/recommend-learning-path', { grades, interests });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 
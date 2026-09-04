const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { auth, isTechnicianOrAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard, featureGuard } = require('../middleware/subscriptionGuard');

// Middleware para rutas que requieren plan con IA habilitada
const requireAI = [auth, tenantContext, subscriptionGuard, featureGuard('ai_assistant')];

// 1. Diagnostico Inteligente (requiere plan con ai_assistant)
router.post('/diagnose', requireAI, async (req, res) => {
    try {
        const { deviceType, brand, model, description, serviceRequested } = req.body;
        if (!description) {
            return res.status(400).json({ message: 'Se requiere una descripcion de la falla para diagnosticar.' });
        }

        const diagnosis = await aiService.generateDiagnosis(deviceType, brand, model, description, serviceRequested);
        res.json(diagnosis);
    } catch (error) {
        console.error('[AI ROUTE] Error en diagnostico:', error);
        res.status(500).json({ message: error.message || 'Error al procesar el diagnostico con la IA.' });
    }
});

// 1b. Auto-completado de cotizaciones conversacionales (requiere plan con ai_assistant)
router.post('/parse-quote', requireAI, async (req, res) => {
    try {
        const { description } = req.body;
        if (!description) {
            return res.status(400).json({ message: 'Se requiere una descripcion para analizar.' });
        }

        const quoteDetails = await aiService.parseQuote(description);
        res.json(quoteDetails);
    } catch (error) {
        console.error('[AI ROUTE] Error en parse-quote:', error);
        res.status(500).json({ message: error.message || 'Error al analizar la cotizacion con la IA.' });
    }
});

// 2. Profesionalizacion de notas tecnicas (requiere plan con ai_assistant y ser tecnico/admin)
router.post('/improve-note', requireAI, isTechnicianOrAdmin, async (req, res) => {
    try {
        const { note } = req.body;
        if (!note) {
            return res.status(400).json({ message: 'Se requiere la nota tecnica.' });
        }

        const improvedNote = await aiService.improveNote(note);
        res.json({ note: improvedNote });
    } catch (error) {
        console.error('[AI ROUTE] Error al profesionalizar nota:', error);
        res.status(500).json({ message: error.message || 'Error al procesar la nota con la IA.' });
    }
});

// 3. Chat de soporte virtual (Publico - sin restriccion de plan)
router.post('/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Se requiere un mensaje.' });
        }

        const reply = await aiService.chatSupport(message, history || []);
        res.json({ reply });
    } catch (error) {
        console.error('[AI ROUTE] Error en chat de soporte:', error);
        res.status(500).json({ message: error.message || 'Error al procesar el chat con la IA.' });
    }
});

module.exports = router;

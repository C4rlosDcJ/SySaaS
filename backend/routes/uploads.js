const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

// Configurar multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
    }
});

// Subir imagen para reparación
router.post('/repair/:repairId', auth, upload.array('images', 10), async (req, res) => {
    try {
        const { repairId } = req.params;
        const { image_type } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No se subieron archivos.' });
        }

        const images = [];
        for (const file of req.files) {
            const [result] = await db.query(
                'INSERT INTO repair_images (repair_id, image_path, image_type) VALUES (?, ?, ?)',
                [repairId, `/uploads/${file.filename}`, image_type || 'before']
            );
            images.push({
                id: result.insertId,
                path: `/uploads/${file.filename}`
            });
        }

        res.status(201).json({
            message: 'Imágenes subidas exitosamente.',
            images
        });
    } catch (error) {
        console.error('[UPLOAD] Error al subir imagen:', error);
        res.status(500).json({ message: 'Error al subir imagen.' });
    }
});

// Subir una sola imagen general (productos, perfiles, etc.)
router.post('/single', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ningún archivo.' });
        }
        res.status(201).json({
            message: 'Imagen subida exitosamente.',
            url: `/uploads/${req.file.filename}`,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('[UPLOAD] Error al subir imagen individual:', error);
        res.status(500).json({ message: 'Error al subir imagen.' });
    }
});

// Eliminar imagen
router.delete('/:imageId', auth, async (req, res) => {
    try {
        const { imageId } = req.params;

        const [images] = await db.query('SELECT * FROM repair_images WHERE id = ?', [imageId]);
        if (images.length === 0) {
            return res.status(404).json({ message: 'Imagen no encontrada.' });
        }

        // Eliminar archivo físico
        const filePath = path.join(__dirname, '..', images[0].image_path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await db.query('DELETE FROM repair_images WHERE id = ?', [imageId]);

        res.json({ message: 'Imagen eliminada exitosamente.' });
    } catch (error) {
        console.error('[UPLOAD] Error al eliminar imagen:', error);
        res.status(500).json({ message: 'Error al eliminar imagen.' });
    }
});

module.exports = router;

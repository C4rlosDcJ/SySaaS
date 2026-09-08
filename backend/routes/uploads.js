const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

// Usar memoryStorage: no se escribe nada al disco
const storage = multer.memoryStorage();

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
        cb(new Error('Solo se permiten imagenes (jpeg, jpg, png, gif, webp)'));
    }
});

/**
 * Convierte un buffer de imagen a una cadena base64 con prefijo data URI.
 * @param {Buffer} buffer - El buffer del archivo de imagen.
 * @param {string} mimetype - El tipo MIME (ej. 'image/webp').
 * @returns {string} La cadena base64 completa, lista para usar en <img src>.
 */
function bufferToBase64DataUrl(buffer, mimetype) {
    return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

// Subir imagenes para una reparacion (multiples archivos)
router.post('/repair/:repairId', auth, upload.array('images', 10), async (req, res) => {
    try {
        const { repairId } = req.params;
        const { image_type } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No se subieron archivos.' });
        }

        const images = [];
        for (const file of req.files) {
            const base64DataUrl = bufferToBase64DataUrl(file.buffer, file.mimetype);

            const [result] = await db.query(
                'INSERT INTO repair_images (repair_id, image_path, image_data, image_type) VALUES (?, NULL, ?, ?)',
                [repairId, base64DataUrl, image_type || 'before']
            );
            images.push({
                id: result.insertId,
                image_data: base64DataUrl
            });
        }

        res.status(201).json({
            message: 'Imagenes subidas exitosamente.',
            images
        });
    } catch (error) {
        console.error('[UPLOAD] Error al subir imagen de reparacion:', error);
        res.status(500).json({ message: 'Error al subir imagen.' });
    }
});

// Subir una sola imagen general (productos, perfiles, etc.) — devuelve base64 data URL directamente
router.post('/single', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            // Tambien aceptar JSON con imageData pre-comprimida desde el cliente
            if (req.body && req.body.imageData) {
                return res.status(201).json({
                    message: 'Imagen recibida exitosamente.',
                    url: req.body.imageData
                });
            }
            return res.status(400).json({ message: 'No se subio ningun archivo.' });
        }

        const base64DataUrl = bufferToBase64DataUrl(req.file.buffer, req.file.mimetype);

        res.status(201).json({
            message: 'Imagen subida exitosamente.',
            url: base64DataUrl
        });
    } catch (error) {
        console.error('[UPLOAD] Error al subir imagen individual:', error);
        res.status(500).json({ message: 'Error al subir imagen.' });
    }
});

// Aceptar imageData base64 via JSON (alternativa sin multipart para imagenes ya comprimidas en cliente)
router.post('/single-b64', auth, async (req, res) => {
    try {
        const { imageData } = req.body;
        if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
            return res.status(400).json({ message: 'imageData invalido.' });
        }
        res.status(201).json({
            message: 'Imagen recibida exitosamente.',
            url: imageData
        });
    } catch (error) {
        console.error('[UPLOAD] Error al procesar imagen base64:', error);
        res.status(500).json({ message: 'Error al procesar imagen.' });
    }
});

// Eliminar imagen de reparacion (ya no hay archivo fisico; solo borrar el registro de BD)
router.delete('/:imageId', auth, async (req, res) => {
    try {
        const { imageId } = req.params;

        const [images] = await db.query('SELECT id FROM repair_images WHERE id = ?', [imageId]);
        if (images.length === 0) {
            return res.status(404).json({ message: 'Imagen no encontrada.' });
        }

        await db.query('DELETE FROM repair_images WHERE id = ?', [imageId]);

        res.json({ message: 'Imagen eliminada exitosamente.' });
    } catch (error) {
        console.error('[UPLOAD] Error al eliminar imagen:', error);
        res.status(500).json({ message: 'Error al eliminar imagen.' });
    }
});

module.exports = router;

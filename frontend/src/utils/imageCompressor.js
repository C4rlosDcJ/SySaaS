/**
 * Utilidad de compresión inteligente de imágenes en cliente (Navegador).
 * Redimensiona y comprime fotos (de móviles, cámaras o PC) antes de subirlas al servidor,
 * reduciendo archivos de 5-10MB a 30-70KB manteniendo excelente calidad visual.
 */

export async function compressImage(file, { maxWidth = 800, maxHeight = 800, quality = 0.82, mimeType = 'image/webp' } = {}) {
    if (!file || !file.type.startsWith('image/')) {
        return file;
    }

    // Si ya es un SVG o GIF animado muy ligero, no procesar
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calcular dimensiones proporcionales
                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Determinar tipo de salida seguro (WebP con fallback a JPEG)
                const targetMime = canvas.toDataURL('image/webp').startsWith('data:image/webp')
                    ? mimeType
                    : 'image/jpeg';

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file); // Fallback al original si falla canvas
                            return;
                        }

                        const ext = targetMime === 'image/webp' ? '.webp' : '.jpg';
                        const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                        const compressedFile = new File([blob], `${originalName}${ext}`, {
                            type: targetMime,
                            lastModified: Date.now()
                        });

                        resolve(compressedFile);
                    },
                    targetMime,
                    quality
                );
            };

            img.onerror = (err) => reject(err);
        };

        reader.onerror = (err) => reject(err);
    });
}

/**
 * Comprime una imagen y devuelve una cadena base64 data URL lista para guardar en la BD.
 * Es preferible a compressImage() cuando el destino es MySQL (almacenamiento persistente).
 *
 * @param {File} file - El archivo de imagen original.
 * @param {object} options - Opciones de compresion (maxWidth, maxHeight, quality, mimeType).
 * @returns {Promise<string>} La cadena base64 con prefijo data URI, ej. "data:image/webp;base64,..."
 */
export async function compressToBase64(file, { maxWidth = 800, maxHeight = 800, quality = 0.82, mimeType = 'image/webp' } = {}) {
    if (!file || !file.type.startsWith('image/')) {
        // Si no es imagen o es invalido, intentar leerlo como base64 de todos modos
        return readFileAsBase64(file);
    }

    // SVG y GIF: no procesar con canvas, leer directamente
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        return readFileAsBase64(file);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calcular dimensiones proporcionales
                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Determinar tipo de salida seguro (WebP con fallback a JPEG)
                const targetMime = canvas.toDataURL('image/webp').startsWith('data:image/webp')
                    ? mimeType
                    : 'image/jpeg';

                const dataUrl = canvas.toDataURL(targetMime, quality);

                if (!dataUrl || dataUrl === 'data:,') {
                    // Fallback: leer el archivo original sin comprimir
                    resolve(readFileAsBase64(file));
                    return;
                }

                resolve(dataUrl);
            };

            img.onerror = () => resolve(readFileAsBase64(file));
        };

        reader.onerror = (err) => reject(err);
    });
}

/**
 * Lee un archivo como base64 data URL sin procesamiento adicional.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (err) => reject(err);
    });
}

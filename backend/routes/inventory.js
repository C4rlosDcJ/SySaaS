const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');
const inventoryController = require('../controllers/inventoryController');

// Todas las rutas requieren autenticación, contexto de tenant, verificación de suscripción y ser admin
router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(isAdmin);

// Categorías
router.get('/categories', inventoryController.getCategories);
router.post('/categories', inventoryController.createCategory);
router.put('/categories/:id', inventoryController.updateCategory);
router.delete('/categories/:id', inventoryController.deleteCategory);

// Productos
router.get('/products', inventoryController.getProducts);
router.get('/products/:id', inventoryController.getProductById);
router.post('/products', inventoryController.createProduct);
router.put('/products/:id', inventoryController.updateProduct);
router.delete('/products/:id', inventoryController.deleteProduct);

// Movimientos de stock
router.get('/stock-movements', inventoryController.getStockMovements);
router.post('/stock-movements', inventoryController.addStockMovement);

// Estadísticas
router.get('/stats', inventoryController.getInventoryStats);

module.exports = router;


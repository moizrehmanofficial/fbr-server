const express = require('express');
const router  = express.Router();
const { authenticate, requireActiveSubscription } = require('../middleware/auth');
const { getProducts, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');

router.use(authenticate, requireActiveSubscription);

router.get('/',       getProducts);
router.post('/',      createProduct);
router.put('/:id',    updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
const express = require('express');
const router  = express.Router();
const { authenticate, requireActiveSubscription } = require('../middleware/auth');
const { getCustomers, createCustomer, updateCustomer, deleteCustomer } = require('../controllers/customerController');

router.use(authenticate, requireActiveSubscription);

router.get('/',      getCustomers);
router.post('/',     createCustomer);
router.put('/:id',   updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
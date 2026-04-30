const Customer = require('../models/Customer');

/* GET /api/customers */
const getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { userId: req.user._id };

    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { ntn:   { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(query).sort({ name: 1 });
    return res.json({ status: 'success', data: { customers } });
  } catch (err) {
    console.error('Get customers error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch customers' });
  }
};

/* POST /api/customers */
const createCustomer = async (req, res) => {
  try {
    const { name, ntn, strn, phone, email, address } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Customer name is required' });
    }

    const customer = new Customer({
      userId: req.user._id,
      name: name.trim(),
      ntn:     ntn     || null,
      strn:    strn    || null,
      phone:   phone   || null,
      email:   email   || null,
      address: address || null,
    });

    await customer.save();
    return res.status(201).json({
      status:  'success',
      message: 'Customer created',
      data:    { customer },
    });
  } catch (err) {
    console.error('Create customer error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to create customer' });
  }
};

/* PUT /api/customers/:id */
const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, userId: req.user._id });
    if (!customer) return res.status(404).json({ status: 'error', message: 'Customer not found' });

    const { name, ntn, strn, phone, email, address } = req.body;
    if (name)              customer.name    = name.trim();
    if (ntn  !== undefined) customer.ntn    = ntn    || null;
    if (strn !== undefined) customer.strn   = strn   || null;
    if (phone !== undefined) customer.phone = phone  || null;
    if (email !== undefined) customer.email = email  || null;
    if (address !== undefined) customer.address = address || null;

    await customer.save();
    return res.json({ status: 'success', message: 'Customer updated', data: { customer } });
  } catch (err) {
    console.error('Update customer error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to update customer' });
  }
};

/* DELETE /api/customers/:id */
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, userId: req.user._id });
    if (!customer) return res.status(404).json({ status: 'error', message: 'Customer not found' });

    await Customer.deleteOne({ _id: req.params.id });
    return res.json({ status: 'success', message: 'Customer deleted' });
  } catch (err) {
    console.error('Delete customer error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to delete customer' });
  }
};

module.exports = { getCustomers, createCustomer, updateCustomer, deleteCustomer };
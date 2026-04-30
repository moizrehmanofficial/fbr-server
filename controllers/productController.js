const Product = require('../models/Product');

const getProducts = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { userId: req.user._id };
    if (search) {
      query.$or = [
        { name:        { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    const products = await Product.find(query).sort({ name: 1 });
    res.json({ status: 'success', data: { products } });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch products' });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, description, unitPrice, taxRate, unit } = req.body;
    if (!name?.trim())  return res.status(400).json({ status: 'error', message: 'Product name is required' });
    if (!unitPrice)     return res.status(400).json({ status: 'error', message: 'Unit price is required' });

    const product = new Product({
      userId:      req.user._id,
      name:        name.trim(),
      description: description || '',
      unitPrice:   parseFloat(unitPrice),
      taxRate:     parseFloat(taxRate) || 0,
      unit:        unit || 'pcs',
    });
    await product.save();
    res.status(201).json({ status: 'success', message: 'Product created', data: { product } });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to create product' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, userId: req.user._id });
    if (!product) return res.status(404).json({ status: 'error', message: 'Product not found' });

    const { name, description, unitPrice, taxRate, unit } = req.body;
    if (name        !== undefined) product.name        = name.trim();
    if (description !== undefined) product.description = description;
    if (unitPrice   !== undefined) product.unitPrice   = parseFloat(unitPrice);
    if (taxRate     !== undefined) product.taxRate     = parseFloat(taxRate) || 0;
    if (unit        !== undefined) product.unit        = unit;

    await product.save();
    res.json({ status: 'success', message: 'Product updated', data: { product } });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to update product' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, userId: req.user._id });
    if (!product) return res.status(404).json({ status: 'error', message: 'Product not found' });
    await Product.deleteOne({ _id: req.params.id });
    res.json({ status: 'success', message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to delete product' });
  }
};

module.exports = { getProducts, createProduct, updateProduct, deleteProduct };
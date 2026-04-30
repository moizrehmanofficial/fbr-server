require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fbr_invoicing');
    console.log('Connected to MongoDB...');

    const existing = await User.findOne({ role: 'admin' });
    if (existing) {
      console.log('✅ Admin already exists:', existing.email);
      process.exit(0);
    }

    const admin = new User({
      email:        process.env.ADMIN_EMAIL    || 'admin@fbrinvoicing.pk',
      password:     process.env.ADMIN_PASSWORD || 'Admin@123456',
      name:         'System Administrator',
      businessName: 'FBR Invoicing Admin',
      role:         'admin',
      isActive:     true,
      isBlocked:    false,
      subscription: {
        isActive:  true,
        plan:      'yearly',
        startDate: new Date(),
        endDate:   new Date('2099-12-31')
      }
    });

    await admin.save();
    console.log('✅ Admin account created successfully!');
    console.log('   Email   :', process.env.ADMIN_EMAIL    || 'admin@fbrinvoicing.pk');
    console.log('   Password:', process.env.ADMIN_PASSWORD || 'Admin@123456');
    console.log('');
    console.log('⚠️  Please change the password after first login!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedAdmin();
/**
 * Trial Extension Script
 * Run this to bypass trial expiration during modernization.
 */
const mongoose = require('mongoose');
const Tenant = require('../server/models/Tenant');
require('dotenv').config();

async function fixTrials() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pos-retail');
        console.log('Connected to DB');

        const futureDate = new Date('2030-01-01');
        const result = await Tenant.updateMany({}, { 
            trialEndsAt: futureDate,
            status: 'active'
        });

        console.log(`Updated ${result.modifiedCount} tenants. Trial extended to 2030.`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixTrials();

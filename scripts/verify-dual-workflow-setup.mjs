/**
 * Verify Dual Workflow Setup
 * Verifies that all collections and indexes for dual workflow are created correctly
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'kisheka_prod';

async function verifySetup() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log('🔍 Verifying Dual Workflow Setup...\n');
    
    // Verify material_requests collection
    console.log('📋 Checking material_requests collection...');
    const materialRequests = db.collection('material_requests');
    const mrIndexes = await materialRequests.indexes();
    const requiredMRIndexes = [
      'requestNumber_unique',
      'requestedBy_status_idx',
      'project_status_idx',
      'status_createdAt_desc'
    ];
    
    const mrIndexNames = mrIndexes.map(idx => idx.name);
    for (const reqIdx of requiredMRIndexes) {
      if (mrIndexNames.includes(reqIdx)) {
        console.log(`   ✅ ${reqIdx}`);
      } else {
        console.log(`   ❌ Missing: ${reqIdx}`);
      }
    }
    
    // Verify purchase_orders collection
    console.log('\n📋 Checking purchase_orders collection...');
    const purchaseOrders = db.collection('purchase_orders');
    const poIndexes = await purchaseOrders.indexes();
    const requiredPOIndexes = [
      'purchaseOrderNumber_unique',
      'supplierId_status_idx',
      'materialRequestId_idx',
      'project_status_idx',
      'status_sentAt_desc'
    ];
    
    const poIndexNames = poIndexes.map(idx => idx.name);
    for (const reqIdx of requiredPOIndexes) {
      if (poIndexNames.includes(reqIdx)) {
        console.log(`   ✅ ${reqIdx}`);
      } else {
        console.log(`   ❌ Missing: ${reqIdx}`);
      }
    }
    
    // Verify materials collection new indexes
    console.log('\n📋 Checking materials collection new indexes...');
    const materials = db.collection('materials');
    const matIndexes = await materials.indexes();
    const requiredMatIndexes = [
      'entryType_idx',
      'purchaseOrderId_idx',
      'materialRequestId_idx',
      'costStatus_idx'
    ];
    
    const matIndexNames = matIndexes.map(idx => idx.name);
    for (const reqIdx of requiredMatIndexes) {
      if (matIndexNames.includes(reqIdx)) {
        console.log(`   ✅ ${reqIdx}`);
      } else {
        console.log(`   ❌ Missing: ${reqIdx}`);
      }
    }
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Verification error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

verifySetup()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));


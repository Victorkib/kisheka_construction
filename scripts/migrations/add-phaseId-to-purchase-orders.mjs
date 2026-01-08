/**
 * Migration: Add phaseId to existing purchase orders
 * Strategy: Inherit phaseId from linked material request or linked material
 * 
 * Run with: node scripts/migrations/add-phaseId-to-purchase-orders.mjs
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

async function migratePurchaseOrdersPhaseId() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    console.log('🔄 Starting migration: Add phaseId to purchase orders...\n');
    
    // Find all POs without phaseId
    const posWithoutPhase = await db.collection('purchase_orders').find({
      phaseId: { $exists: false },
      deletedAt: null
    }).toArray();
    
    console.log(`📊 Found ${posWithoutPhase.length} purchase orders without phaseId\n`);
    
    if (posWithoutPhase.length === 0) {
      console.log('✅ No purchase orders need migration. All POs already have phaseId.\n');
      return;
    }
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const po of posWithoutPhase) {
      try {
        let phaseId = null;
        
        // Strategy 1: Try to get phaseId from material request
        if (po.materialRequestId) {
          const materialRequest = await db.collection('material_requests').findOne({
            _id: po.materialRequestId,
            deletedAt: null
          });
          
          if (materialRequest?.phaseId) {
            phaseId = materialRequest.phaseId;
            console.log(`  ✓ PO ${po.purchaseOrderNumber}: Found phaseId from material request`);
          }
        }
        
        // Strategy 2: Try to get phaseId from linked material (if material exists)
        if (!phaseId && po.linkedMaterialId) {
          const material = await db.collection('materials').findOne({
            _id: po.linkedMaterialId,
            deletedAt: null
          });
          
          if (material?.phaseId) {
            phaseId = material.phaseId;
            console.log(`  ✓ PO ${po.purchaseOrderNumber}: Found phaseId from linked material`);
          }
        }
        
        // Strategy 3: For bulk orders, try to get phaseId from first material request
        if (!phaseId && po.isBulkOrder && po.materialRequestIds && Array.isArray(po.materialRequestIds) && po.materialRequestIds.length > 0) {
          const firstRequestId = po.materialRequestIds[0];
          const materialRequest = await db.collection('material_requests').findOne({
            _id: new ObjectId(firstRequestId),
            deletedAt: null
          });
          
          if (materialRequest?.phaseId) {
            phaseId = materialRequest.phaseId;
            console.log(`  ✓ PO ${po.purchaseOrderNumber}: Found phaseId from first material request in bulk order`);
          }
        }
        
        // Update PO if phaseId found
        if (phaseId) {
          // Validate phaseId is valid ObjectId
          if (typeof phaseId === 'object' || (typeof phaseId === 'string' && /^[0-9a-fA-F]{24}$/.test(phaseId))) {
            await db.collection('purchase_orders').updateOne(
              { _id: po._id },
              { 
                $set: { 
                  phaseId: typeof phaseId === 'string' ? new ObjectId(phaseId) : phaseId,
                  updatedAt: new Date() 
                } 
              }
            );
            updated++;
          } else {
            console.log(`  ⚠ PO ${po.purchaseOrderNumber}: Invalid phaseId format, skipping`);
            skipped++;
          }
        } else {
          console.log(`  ⚠ PO ${po.purchaseOrderNumber}: No phaseId found in material request or linked material, skipping`);
          skipped++;
        }
      } catch (error) {
        console.error(`  ❌ Error processing PO ${po.purchaseOrderNumber}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⚠ Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📦 Total: ${posWithoutPhase.length}\n`);
    
    if (skipped > 0) {
      console.log('⚠️  Note: Some POs were skipped because phaseId could not be determined.');
      console.log('   These POs may need manual phase assignment.\n');
    }
    
    console.log('✅ Migration complete!\n');
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run migration
migratePurchaseOrdersPhaseId()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });


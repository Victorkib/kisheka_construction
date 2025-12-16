/**
 * Atomicity Fixes Migration Script
 * 
 * This script migrates existing data to support the new atomicity features:
 * 1. Backfills idempotency keys for existing purchase orders
 * 2. Detects and fixes orphaned material requests (marked as converted but no PO exists)
 * 3. Validates data consistency
 * 4. Reports on issues found and fixed
 * 
 * Run with: node scripts/migrate-atomicity-fixes.mjs
 * Or: npm run migrate:atomicity (if added to package.json)
 */

import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

/**
 * Generate idempotency key from purchase order data
 */
function generateIdempotencyKey(po) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      materialRequestId: po.materialRequestId?.toString() || '',
      supplierId: po.supplierId?.toString() || '',
      quantityOrdered: po.quantityOrdered || 0,
      unitCost: po.unitCost || 0,
      deliveryDate: po.deliveryDate ? new Date(po.deliveryDate).toISOString().split('T')[0] : '',
    }))
    .digest('hex');
}

async function migrateAtomicityFixes() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    console.log('🔄 Starting atomicity fixes migration...\n');
    
    const results = {
      idempotencyKeysBackfilled: 0,
      orphanedRequestsFixed: 0,
      orphanedRequestsFound: 0,
      inconsistentLinksFixed: 0,
      errors: [],
    };
    
    // ============================================
    // 1. BACKFILL IDEMPOTENCY KEYS
    // ============================================
    console.log('📋 Step 1: Backfilling idempotency keys for purchase orders...');
    const purchaseOrdersCollection = db.collection('purchase_orders');
    
    // Find all purchase orders without idempotency keys
    const posWithoutKeys = await purchaseOrdersCollection.find({
      $or: [
        { idempotencyKey: { $exists: false } },
        { idempotencyKey: null },
        { idempotencyKey: '' }
      ],
      deletedAt: null
    }).toArray();
    
    console.log(`   Found ${posWithoutKeys.length} purchase orders without idempotency keys`);
    
    if (posWithoutKeys.length > 0) {
      for (const po of posWithoutKeys) {
        try {
          const idempotencyKey = generateIdempotencyKey(po);
          
          await purchaseOrdersCollection.updateOne(
            { _id: po._id },
            { $set: { idempotencyKey } }
          );
          
          results.idempotencyKeysBackfilled++;
        } catch (error) {
          console.error(`   ❌ Error backfilling key for PO ${po._id}:`, error.message);
          results.errors.push({
            type: 'idempotency_backfill',
            poId: po._id.toString(),
            error: error.message
          });
        }
      }
      console.log(`   ✅ Backfilled ${results.idempotencyKeysBackfilled} idempotency keys\n`);
    } else {
      console.log('   ✅ All purchase orders already have idempotency keys\n');
    }
    
    // ============================================
    // 2. DETECT ORPHANED MATERIAL REQUESTS
    // ============================================
    console.log('📋 Step 2: Detecting orphaned material requests...');
    const materialRequestsCollection = db.collection('material_requests');
    
    // Find material requests marked as converted but no PO exists
    const orphanedRequests = await materialRequestsCollection.find({
      status: 'converted_to_order',
      $or: [
        { linkedPurchaseOrderId: { $exists: false } },
        { linkedPurchaseOrderId: null }
      ],
      deletedAt: null
    }).toArray();
    
    console.log(`   Found ${orphanedRequests.length} orphaned material requests (converted but no linked PO)`);
    results.orphanedRequestsFound = orphanedRequests.length;
    
    if (orphanedRequests.length > 0) {
      console.log('   🔍 Attempting to find matching purchase orders...');
      
      for (const request of orphanedRequests) {
        try {
          // Try to find a purchase order that matches this material request
          const matchingPO = await purchaseOrdersCollection.findOne({
            materialRequestId: request._id,
            deletedAt: null
          });
          
          if (matchingPO) {
            // Found matching PO - fix the link
            await materialRequestsCollection.updateOne(
              { _id: request._id },
              {
                $set: {
                  linkedPurchaseOrderId: matchingPO._id,
                  updatedAt: new Date()
                }
              }
            );
            
            results.orphanedRequestsFixed++;
            console.log(`   ✅ Fixed orphaned request ${request._id} - linked to PO ${matchingPO._id}`);
          } else {
            // No matching PO found - revert status to approved
            await materialRequestsCollection.updateOne(
              { _id: request._id },
              {
                $set: {
                  status: 'approved',
                  updatedAt: new Date()
                },
                $unset: {
                  linkedPurchaseOrderId: ''
                }
              }
            );
            
            results.orphanedRequestsFixed++;
            console.log(`   ✅ Reverted orphaned request ${request._id} to 'approved' status (no matching PO found)`);
          }
        } catch (error) {
          console.error(`   ❌ Error fixing orphaned request ${request._id}:`, error.message);
          results.errors.push({
            type: 'orphaned_request_fix',
            requestId: request._id.toString(),
            error: error.message
          });
        }
      }
      
      console.log(`   ✅ Fixed ${results.orphanedRequestsFixed} orphaned material requests\n`);
    } else {
      console.log('   ✅ No orphaned material requests found\n');
    }
    
    // ============================================
    // 3. VALIDATE LINK CONSISTENCY
    // ============================================
    console.log('📋 Step 3: Validating link consistency...');
    
    // Find material requests with linkedPurchaseOrderId but PO doesn't exist
    const requestsWithInvalidLinks = await materialRequestsCollection.find({
      linkedPurchaseOrderId: { $exists: true, $ne: null },
      deletedAt: null
    }).toArray();
    
    console.log(`   Checking ${requestsWithInvalidLinks.length} material requests with linked POs...`);
    
    let inconsistentCount = 0;
    
    for (const request of requestsWithInvalidLinks) {
      try {
        if (!ObjectId.isValid(request.linkedPurchaseOrderId)) {
          // Invalid ObjectId - remove the link
          await materialRequestsCollection.updateOne(
            { _id: request._id },
            {
              $set: {
                status: 'approved',
                updatedAt: new Date()
              },
              $unset: {
                linkedPurchaseOrderId: ''
              }
            }
          );
          inconsistentCount++;
          results.inconsistentLinksFixed++;
          continue;
        }
        
        const linkedPO = await purchaseOrdersCollection.findOne({
          _id: new ObjectId(request.linkedPurchaseOrderId),
          deletedAt: null
        });
        
        if (!linkedPO) {
          // PO doesn't exist - remove the link and revert status
          // Use separate operations to avoid conflict
          await materialRequestsCollection.updateOne(
            { _id: request._id },
            {
              $unset: {
                linkedPurchaseOrderId: ''
              }
            }
          );
          await materialRequestsCollection.updateOne(
            { _id: request._id },
            {
              $set: {
                status: 'approved',
                updatedAt: new Date()
              }
            }
          );
          inconsistentCount++;
          results.inconsistentLinksFixed++;
          console.log(`   ✅ Fixed invalid link in request ${request._id} - PO ${request.linkedPurchaseOrderId} doesn't exist`);
        } else if (linkedPO.materialRequestId?.toString() !== request._id.toString()) {
          // PO exists but doesn't link back to this request
          console.log(`   ⚠️  Warning: Request ${request._id} links to PO ${linkedPO._id}, but PO links to different request ${linkedPO.materialRequestId}`);
        }
      } catch (error) {
        console.error(`   ❌ Error validating link for request ${request._id}:`, error.message);
        results.errors.push({
          type: 'link_validation',
          requestId: request._id.toString(),
          error: error.message
        });
      }
    }
    
    if (inconsistentCount === 0) {
      console.log('   ✅ All links are consistent\n');
    } else {
      console.log(`   ✅ Fixed ${inconsistentCount} inconsistent links\n`);
    }
    
    // ============================================
    // 4. CHECK FOR DUPLICATE IDEMPOTENCY KEYS
    // ============================================
    console.log('📋 Step 4: Checking for duplicate idempotency keys...');
    
    const duplicateKeys = await purchaseOrdersCollection.aggregate([
      {
        $match: {
          idempotencyKey: { $exists: true, $ne: null, $ne: '' },
          deletedAt: null
        }
      },
      {
        $group: {
          _id: '$idempotencyKey',
          count: { $sum: 1 },
          poIds: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();
    
    if (duplicateKeys.length > 0) {
      console.log(`   ⚠️  Found ${duplicateKeys.length} duplicate idempotency keys:`);
      for (const dup of duplicateKeys) {
        console.log(`      Key: ${dup._id.substring(0, 16)}... (${dup.count} POs)`);
        console.log(`      PO IDs: ${dup.poIds.map(id => id.toString()).join(', ')}`);
      }
      console.log('   ℹ️  These are expected if multiple POs were created with same parameters\n');
    } else {
      console.log('   ✅ No duplicate idempotency keys found\n');
    }
    
    // ============================================
    // 5. SUMMARY REPORT
    // ============================================
    console.log('='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Idempotency keys backfilled: ${results.idempotencyKeysBackfilled}`);
    console.log(`✅ Orphaned requests found: ${results.orphanedRequestsFound}`);
    console.log(`✅ Orphaned requests fixed: ${results.orphanedRequestsFixed}`);
    console.log(`✅ Inconsistent links fixed: ${results.inconsistentLinksFixed}`);
    console.log(`❌ Errors encountered: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.type} - ${error.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run migration
migrateAtomicityFixes()
  .then(() => {
    console.log('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });


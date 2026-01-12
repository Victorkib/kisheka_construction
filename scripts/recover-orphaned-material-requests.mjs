/**
 * Recovery Script: Orphaned Material Requests
 * 
 * Finds and fixes material requests that have status 'converted_to_order'
 * but no linkedPurchaseOrderId or the linked purchase order doesn't exist.
 * 
 * This script:
 * 1. Finds orphaned requests (status: 'converted_to_order' but no valid linkedPurchaseOrderId)
 * 2. Verifies no purchase order exists for them
 * 3. Resets status to 'approved' so they can be retried
 * 4. Logs all recovery actions
 * 
 * Usage: node scripts/recover-orphaned-material-requests.mjs
 */

import { MongoClient, ObjectId } from 'mongodb';
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

async function recoverOrphanedRequests() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...\n');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    
    // Find material requests with status 'converted_to_order'
    const materialRequests = await db.collection('material_requests').find({
      status: 'converted_to_order',
      deletedAt: null,
    }).toArray();
    
    console.log(`📋 Found ${materialRequests.length} material request(s) with status 'converted_to_order'\n`);
    
    if (materialRequests.length === 0) {
      console.log('✅ No orphaned requests found. Database is clean!');
      return;
    }
    
    const orphanedRequests = [];
    const validRequests = [];
    
    // Check each request
    for (const request of materialRequests) {
      const hasLinkedPO = request.linkedPurchaseOrderId && ObjectId.isValid(request.linkedPurchaseOrderId);
      
      if (!hasLinkedPO) {
        // No linkedPurchaseOrderId - definitely orphaned
        orphanedRequests.push({
          ...request,
          reason: 'Missing linkedPurchaseOrderId',
        });
        continue;
      }
      
      // Check if the linked purchase order exists
      const purchaseOrder = await db.collection('purchase_orders').findOne({
        _id: new ObjectId(request.linkedPurchaseOrderId),
        deletedAt: null,
      });
      
      if (!purchaseOrder) {
        // Purchase order doesn't exist - orphaned
        orphanedRequests.push({
          ...request,
          reason: `Linked purchase order ${request.linkedPurchaseOrderId} does not exist`,
        });
      } else {
        // Purchase order exists - valid
        validRequests.push({
          requestId: request._id,
          requestNumber: request.requestNumber,
          poId: purchaseOrder._id,
          poNumber: purchaseOrder.purchaseOrderNumber,
        });
      }
    }
    
    console.log(`✅ Valid requests (with existing PO): ${validRequests.length}`);
    console.log(`⚠️  Orphaned requests (need recovery): ${orphanedRequests.length}\n`);
    
    if (orphanedRequests.length === 0) {
      console.log('✅ No orphaned requests found. All requests have valid purchase orders!');
      return;
    }
    
    // Display orphaned requests
    console.log('📋 Orphaned Material Requests:\n');
    orphanedRequests.forEach((req, index) => {
      console.log(`${index + 1}. Request: ${req.requestNumber || req._id}`);
      console.log(`   Material: ${req.materialName}`);
      console.log(`   Project: ${req.projectId}`);
      console.log(`   Reason: ${req.reason}`);
      console.log(`   Created: ${req.createdAt}`);
      console.log(`   Updated: ${req.updatedAt}`);
      console.log('');
    });
    
    // Ask for confirmation (in automated mode, we'll proceed)
    console.log('🔄 Starting recovery process...\n');
    
    let recoveredCount = 0;
    let errorCount = 0;
    
    // Recover each orphaned request
    for (const request of orphanedRequests) {
      try {
        // Reset status to 'approved' and clear linkedPurchaseOrderId
        const result = await db.collection('material_requests').updateOne(
          { _id: request._id },
          {
            $set: {
              status: 'approved',
              updatedAt: new Date(),
            },
            $unset: {
              linkedPurchaseOrderId: '',
            },
          }
        );
        
        if (result.modifiedCount > 0) {
          recoveredCount++;
          console.log(`✅ Recovered: ${request.requestNumber || request._id} - Status reset to 'approved'`);
        } else {
          console.log(`⚠️  No changes needed: ${request.requestNumber || request._id}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error recovering ${request.requestNumber || request._id}:`, error.message);
      }
    }
    
    console.log('\n📊 Recovery Summary:');
    console.log(`   ✅ Successfully recovered: ${recoveredCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total orphaned requests: ${orphanedRequests.length}\n`);
    
    if (recoveredCount > 0) {
      console.log('✅ Recovery complete! Orphaned requests have been reset to "approved" status.');
      console.log('💡 Users can now retry creating purchase orders for these requests.\n');
    }
    
    // Create recovery audit log
    if (recoveredCount > 0) {
      try {
        await db.collection('audit_logs').insertOne({
          action: 'RECOVER_ORPHANED_MATERIAL_REQUESTS',
          entityType: 'SYSTEM',
          entityId: 'recovery_script',
          changes: {
            recoveredCount,
            errorCount,
            orphanedRequests: orphanedRequests.map(req => ({
              requestId: req._id.toString(),
              requestNumber: req.requestNumber,
              reason: req.reason,
            })),
          },
          createdAt: new Date(),
        });
        console.log('📝 Recovery audit log created');
      } catch (error) {
        console.warn('⚠️  Could not create audit log:', error.message);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Recovery script error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Run the recovery
recoverOrphanedRequests()
  .then(() => {
    console.log('\n🎉 Recovery script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Recovery script failed:', error);
    process.exit(1);
  });





























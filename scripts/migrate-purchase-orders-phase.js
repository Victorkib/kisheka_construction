/**
 * Migration Script: Add phaseId to Existing Purchase Orders
 * 
 * This script migrates existing purchase orders to include phaseId by:
 * 1. Finding POs without phaseId
 * 2. Attempting to inherit phaseId from their linked material request
 * 3. If material request also lacks phaseId, attempting to find phase from project's first active phase
 * 4. Logging all migrations for review
 * 
 * Usage: node scripts/migrate-purchase-orders-phase.js
 * 
 * IMPORTANT: Review the migration log before running in production!
 */

import { getDatabase } from '../src/lib/mongodb/connection.js';
import { ObjectId } from 'mongodb';

async function migratePurchaseOrdersPhase() {
  const db = await getDatabase();
  
  console.log('🚀 Starting Purchase Order Phase Migration...\n');
  
  // Find all purchase orders without phaseId
  const posWithoutPhase = await db.collection('purchase_orders')
    .find({
      $or: [
        { phaseId: { $exists: false } },
        { phaseId: null },
      ],
      deletedAt: null,
    })
    .toArray();
  
  console.log(`📊 Found ${posWithoutPhase.length} purchase orders without phaseId\n`);
  
  if (posWithoutPhase.length === 0) {
    console.log('✅ No purchase orders need migration. All POs already have phaseId.');
    process.exit(0);
  }
  
  const migrationResults = {
    total: posWithoutPhase.length,
    migrated: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };
  
  for (const po of posWithoutPhase) {
    try {
      let phaseId = null;
      let migrationMethod = '';
      
      // Strategy 1: Inherit from material request
      if (po.materialRequestId && ObjectId.isValid(po.materialRequestId)) {
        const materialRequest = await db.collection('material_requests').findOne({
          _id: new ObjectId(po.materialRequestId),
          deletedAt: null,
        });
        
        if (materialRequest && materialRequest.phaseId && ObjectId.isValid(materialRequest.phaseId)) {
          phaseId = materialRequest.phaseId;
          migrationMethod = 'inherited_from_material_request';
        }
      }
      
      // Strategy 2: Use project's first active phase (fallback)
      if (!phaseId && po.projectId && ObjectId.isValid(po.projectId)) {
        const firstPhase = await db.collection('phases').findOne({
          projectId: new ObjectId(po.projectId),
          deletedAt: null,
        }, {
          sort: { createdAt: 1 }, // Get oldest phase
        });
        
        if (firstPhase) {
          phaseId = firstPhase._id;
          migrationMethod = 'assigned_from_project_first_phase';
        }
      }
      
      if (phaseId) {
        // Update the purchase order
        await db.collection('purchase_orders').updateOne(
          { _id: po._id },
          {
            $set: {
              phaseId: new ObjectId(phaseId),
              updatedAt: new Date(),
            },
          }
        );
        
        migrationResults.migrated++;
        migrationResults.details.push({
          poId: po._id.toString(),
          poNumber: po.purchaseOrderNumber || 'N/A',
          method: migrationMethod,
          phaseId: phaseId.toString(),
          status: 'success',
        });
        
        console.log(`✅ Migrated PO ${po.purchaseOrderNumber || po._id}: ${migrationMethod}`);
      } else {
        // Cannot migrate - no phase available
        migrationResults.skipped++;
        migrationResults.details.push({
          poId: po._id.toString(),
          poNumber: po.purchaseOrderNumber || 'N/A',
          method: 'none_available',
          phaseId: null,
          status: 'skipped',
          reason: 'No phase available from material request or project',
        });
        
        console.log(`⚠️  Skipped PO ${po.purchaseOrderNumber || po._id}: No phase available`);
      }
    } catch (error) {
      migrationResults.failed++;
      migrationResults.details.push({
        poId: po._id.toString(),
        poNumber: po.purchaseOrderNumber || 'N/A',
        method: 'error',
        phaseId: null,
        status: 'failed',
        error: error.message,
      });
      
      console.error(`❌ Failed to migrate PO ${po.purchaseOrderNumber || po._id}:`, error.message);
    }
  }
  
  // Print summary
  console.log('\n📈 Migration Summary:');
  console.log(`   Total POs processed: ${migrationResults.total}`);
  console.log(`   ✅ Successfully migrated: ${migrationResults.migrated}`);
  console.log(`   ⚠️  Skipped (no phase available): ${migrationResults.skipped}`);
  console.log(`   ❌ Failed: ${migrationResults.failed}`);
  
  // Save migration log
  const migrationLog = {
    timestamp: new Date(),
    results: migrationResults,
  };
  
  await db.collection('migration_logs').insertOne(migrationLog);
  console.log('\n💾 Migration log saved to database');
  
  console.log('\n✨ Migration complete!');
  
  if (migrationResults.skipped > 0) {
    console.log('\n⚠️  WARNING: Some POs were skipped because no phase was available.');
    console.log('   These POs will need manual phase assignment.');
  }
  
  process.exit(0);
}

// Run migration
migratePurchaseOrdersPhase().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});


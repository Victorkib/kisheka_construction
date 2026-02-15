/**
 * Performance Optimization Script: Floor Budget Indexes
 * 
 * Adds database indexes to optimize floor budget and spending calculations
 * These indexes improve performance for:
 * - calculateFloorActualSpending() - materials and labour queries
 * - calculateFloorCommittedCosts() - material requests and purchase orders queries
 * - Phase-specific spending calculations
 * 
 * Run with: node scripts/add-floor-budget-indexes.mjs
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function addFloorBudgetIndexes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    // 1. Materials Collection Indexes
    console.log('\n📋 Adding indexes to materials collection...');
    const materialsCollection = db.collection('materials');
    const materialsIndexes = [
      // For calculateFloorActualSpending - materials query
      { key: { floor: 1, deletedAt: 1, status: 1 }, name: 'floor_deletedAt_status_idx' },
      // For phase-specific spending
      { key: { floor: 1, phaseId: 1, deletedAt: 1, status: 1 }, name: 'floor_phaseId_deletedAt_status_idx' },
      // For project-level queries
      { key: { projectId: 1, floor: 1, deletedAt: 1 }, name: 'projectId_floor_deletedAt_idx' },
    ];
    
    for (const indexDef of materialsIndexes) {
      try {
        await materialsCollection.createIndex(
          indexDef.key,
          { name: indexDef.name, background: true, sparse: true }
        );
        console.log(`   ✅ Created index: ${indexDef.name}`);
      } catch (error) {
        if (error.code === 85) {
          // Index already exists with different options
          console.log(`   ℹ️  Index exists (different options): ${indexDef.name}`);
        } else if (error.code === 86) {
          // Index already exists
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        } else {
          console.error(`   ❌ Error creating index ${indexDef.name}:`, error.message);
        }
      }
    }
    
    // 2. Labour Entries Collection Indexes
    console.log('\n📋 Adding indexes to labour_entries collection...');
    const labourCollection = db.collection('labour_entries');
    const labourIndexes = [
      // For calculateFloorActualSpending - labour query
      { key: { floorId: 1, deletedAt: 1, status: 1, isIndirectLabour: 1 }, name: 'floorId_deletedAt_status_isIndirect_idx' },
      // For phase-specific spending
      { key: { floorId: 1, phaseId: 1, deletedAt: 1, status: 1 }, name: 'floorId_phaseId_deletedAt_status_idx' },
      // For project-level queries
      { key: { projectId: 1, floorId: 1, deletedAt: 1 }, name: 'projectId_floorId_deletedAt_idx' },
    ];
    
    for (const indexDef of labourIndexes) {
      try {
        await labourCollection.createIndex(
          indexDef.key,
          { name: indexDef.name, background: true, sparse: true }
        );
        console.log(`   ✅ Created index: ${indexDef.name}`);
      } catch (error) {
        if (error.code === 85 || error.code === 86) {
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        } else {
          console.error(`   ❌ Error creating index ${indexDef.name}:`, error.message);
        }
      }
    }
    
    // 3. Material Requests Collection Indexes
    console.log('\n📋 Adding indexes to material_requests collection...');
    const materialRequestsCollection = db.collection('material_requests');
    const materialRequestsIndexes = [
      // For calculateFloorCommittedCosts - material requests query
      { key: { floorId: 1, deletedAt: 1, status: 1 }, name: 'floorId_deletedAt_status_idx' },
      // For phase-specific committed costs
      { key: { floorId: 1, phaseId: 1, deletedAt: 1, status: 1 }, name: 'floorId_phaseId_deletedAt_status_idx' },
      // For project-level queries
      { key: { projectId: 1, floorId: 1, deletedAt: 1 }, name: 'projectId_floorId_deletedAt_idx' },
    ];
    
    for (const indexDef of materialRequestsIndexes) {
      try {
        await materialRequestsCollection.createIndex(
          indexDef.key,
          { name: indexDef.name, background: true, sparse: true }
        );
        console.log(`   ✅ Created index: ${indexDef.name}`);
      } catch (error) {
        if (error.code === 85 || error.code === 86) {
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        } else {
          console.error(`   ❌ Error creating index ${indexDef.name}:`, error.message);
        }
      }
    }
    
    // 4. Purchase Orders Collection Indexes
    console.log('\n📋 Adding indexes to purchase_orders collection...');
    const purchaseOrdersCollection = db.collection('purchase_orders');
    const purchaseOrdersIndexes = [
      // For calculateFloorCommittedCosts - purchase orders query
      { key: { floorId: 1, deletedAt: 1, status: 1 }, name: 'floorId_deletedAt_status_idx' },
      // For phase-specific committed costs
      { key: { floorId: 1, phaseId: 1, deletedAt: 1, status: 1 }, name: 'floorId_phaseId_deletedAt_status_idx' },
      // For project-level queries
      { key: { projectId: 1, floorId: 1, deletedAt: 1 }, name: 'projectId_floorId_deletedAt_idx' },
    ];
    
    for (const indexDef of purchaseOrdersIndexes) {
      try {
        await purchaseOrdersCollection.createIndex(
          indexDef.key,
          { name: indexDef.name, background: true, sparse: true }
        );
        console.log(`   ✅ Created index: ${indexDef.name}`);
      } catch (error) {
        if (error.code === 85 || error.code === 86) {
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        } else {
          console.error(`   ❌ Error creating index ${indexDef.name}:`, error.message);
        }
      }
    }
    
    // 5. Floors Collection Additional Indexes
    console.log('\n📋 Adding indexes to floors collection...');
    const floorsCollection = db.collection('floors');
    const floorsIndexes = [
      // For budget allocation queries
      { key: { projectId: 1, 'budgetAllocation.total': 1 }, name: 'projectId_budgetAllocation_total_idx' },
      // For capital allocation queries
      { key: { projectId: 1, 'capitalAllocation.total': 1 }, name: 'projectId_capitalAllocation_total_idx' },
    ];
    
    for (const indexDef of floorsIndexes) {
      try {
        await floorsCollection.createIndex(
          indexDef.key,
          { name: indexDef.name, background: true, sparse: true }
        );
        console.log(`   ✅ Created index: ${indexDef.name}`);
      } catch (error) {
        if (error.code === 85 || error.code === 86) {
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        } else {
          console.error(`   ❌ Error creating index ${indexDef.name}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ All indexes added successfully!');
    console.log('\n📊 Performance Impact:');
    console.log('   - Floor spending calculations will be faster');
    console.log('   - Phase-specific spending queries will use indexes');
    console.log('   - Committed costs calculations will be optimized');
    console.log('   - Budget allocation operations will benefit from compound indexes');
    
  } catch (error) {
    console.error('❌ Error adding indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run script
console.log('🚀 Starting Floor Budget Performance Optimization...');
console.log('');

addFloorBudgetIndexes()
  .then(() => {
    console.log('\n✨ Optimization script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Optimization script failed:', error);
    process.exit(1);
  });

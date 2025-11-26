/**
 * Migration Script: Standardize Material Field Names
 * 
 * This script standardizes field names in the materials collection:
 * - materialName → name (keep name, remove materialName)
 * - quantity → quantityPurchased (keep quantityPurchased, remove quantity)
 * - supplier → supplierName (keep supplierName, remove supplier)
 * - receiptUrl → receiptFileUrl (keep receiptFileUrl, remove receiptUrl)
 * - totalPrice → totalCost (keep totalCost, remove totalPrice if exists)
 * 
 * Run with: node scripts/migrate-material-fields.mjs
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
const MONGODB_DB = process.env.MONGODB_DB || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function migrateMaterialFields() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(MONGODB_DB);
    const materialsCollection = db.collection('materials');
    
    // Get all materials
    console.log('📊 Fetching all materials...');
    const materials = await materialsCollection.find({}).toArray();
    console.log(`📦 Found ${materials.length} materials to migrate`);
    
    if (materials.length === 0) {
      console.log('✅ No materials to migrate');
      return;
    }
    
    let updated = 0;
    let skipped = 0;
    
    for (const material of materials) {
      const updates = {};
      let needsUpdate = false;
      
      // Standardize name (keep name, remove materialName if different)
      if (material.materialName && material.materialName !== material.name) {
        if (!material.name) {
          updates.name = material.materialName;
          needsUpdate = true;
        }
        updates.$unset = { materialName: '' };
        needsUpdate = true;
      } else if (material.materialName && material.materialName === material.name) {
        updates.$unset = { materialName: '' };
        needsUpdate = true;
      }
      
      // Standardize quantity (keep quantityPurchased, remove quantity if different)
      if (material.quantity !== undefined && material.quantity !== material.quantityPurchased) {
        if (!material.quantityPurchased) {
          updates.quantityPurchased = material.quantity;
          needsUpdate = true;
        }
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.quantity = '';
        needsUpdate = true;
      } else if (material.quantity !== undefined && material.quantity === material.quantityPurchased) {
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.quantity = '';
        needsUpdate = true;
      }
      
      // Standardize supplier (keep supplierName, remove supplier if different)
      if (material.supplier && material.supplier !== material.supplierName) {
        if (!material.supplierName) {
          updates.supplierName = material.supplier;
          needsUpdate = true;
        }
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.supplier = '';
        needsUpdate = true;
      } else if (material.supplier && material.supplier === material.supplierName) {
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.supplier = '';
        needsUpdate = true;
      }
      
      // Standardize receipt (keep receiptFileUrl, remove receiptUrl if different)
      if (material.receiptUrl && material.receiptUrl !== material.receiptFileUrl) {
        if (!material.receiptFileUrl) {
          updates.receiptFileUrl = material.receiptUrl;
          needsUpdate = true;
        }
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.receiptUrl = '';
        needsUpdate = true;
      } else if (material.receiptUrl && material.receiptUrl === material.receiptFileUrl) {
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.receiptUrl = '';
        needsUpdate = true;
      }
      
      // Remove totalPrice if it exists (should use totalCost)
      if (material.totalPrice !== undefined) {
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.totalPrice = '';
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        // Prepare update operation
        const updateOp = {};
        if (updates.name) updateOp.name = updates.name;
        if (updates.quantityPurchased !== undefined) updateOp.quantityPurchased = updates.quantityPurchased;
        if (updates.supplierName) updateOp.supplierName = updates.supplierName;
        if (updates.receiptFileUrl) updateOp.receiptFileUrl = updates.receiptFileUrl;
        if (updates.$unset) updateOp.$unset = updates.$unset;
        
        await materialsCollection.updateOne(
          { _id: material._id },
          { $set: updateOp.$set || {}, $unset: updateOp.$unset || {} }
        );
        
        updated++;
        console.log(`✅ Updated material: ${material._id} (${material.name || material.materialName || 'Unknown'})`);
      } else {
        skipped++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Updated: ${updated} materials`);
    console.log(`⏭️  Skipped: ${skipped} materials (already standardized)`);
    console.log(`📦 Total: ${materials.length} materials`);
    
    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const materialsWithOldFields = await materialsCollection.find({
      $or: [
        { materialName: { $exists: true } },
        { quantity: { $exists: true } },
        { supplier: { $exists: true } },
        { receiptUrl: { $exists: true } },
        { totalPrice: { $exists: true } },
      ],
    }).toArray();
    
    if (materialsWithOldFields.length > 0) {
      console.warn(`⚠️  Warning: ${materialsWithOldFields.length} materials still have old field names`);
      console.warn('   This may be expected if fields were intentionally kept for backward compatibility');
    } else {
      console.log('✅ All materials have been standardized');
    }
    
    console.log('\n✅ Migration completed successfully!');
    
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
migrateMaterialFields()
  .then(() => {
    console.log('\n🎉 Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });


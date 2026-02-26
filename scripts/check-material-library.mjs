#!/usr/bin/env node

/**
 * Check Material Library Script
 * Diagnostic script to check material library entries
 * 
 * Usage: node scripts/check-material-library.mjs [materialId]
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

async function checkMaterialLibrary() {
  let client;
  const materialId = process.argv[2];

  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB);

    console.log('✅ Connected to MongoDB\n');

    if (materialId) {
      // Check specific material
      console.log(`🔍 Checking material with ID: ${materialId}\n`);

      if (!ObjectId.isValid(materialId)) {
        console.error('❌ Invalid ObjectId format');
        process.exit(1);
      }

      const material = await db.collection('material_library').findOne({
        _id: new ObjectId(materialId),
      });

      if (!material) {
        console.log('❌ Material not found in database');
        console.log(`   Searched for ID: ${materialId}`);
        
        // Check if there are any materials with similar IDs
        const allMaterials = await db.collection('material_library')
          .find({})
          .limit(10)
          .toArray();
        
        console.log(`\n📋 Sample material IDs in database:`);
        allMaterials.forEach(m => {
          console.log(`   - ${m._id.toString()}`);
        });
      } else {
        console.log('✅ Material found!\n');
        console.log('📋 Material Details:');
        console.log(`   ID: ${material._id.toString()}`);
        console.log(`   Name: ${material.name}`);
        console.log(`   Category: ${material.category || 'N/A'}`);
        console.log(`   Unit: ${material.defaultUnit}`);
        console.log(`   Active: ${material.isActive}`);
        console.log(`   Common: ${material.isCommon}`);
        console.log(`   Usage Count: ${material.usageCount || 0}`);
        console.log(`   Created At: ${material.createdAt}`);
        console.log(`   Updated At: ${material.updatedAt}`);
        console.log(`   Deleted At: ${material.deletedAt || 'Not deleted'}`);
        console.log(`   Created By: ${material.createdBy ? material.createdBy.toString() : 'null (seeded)'}`);

        // Check if it's queryable with deletedAt: null
        const activeMaterial = await db.collection('material_library').findOne({
          _id: new ObjectId(materialId),
          deletedAt: null,
        });

        if (!activeMaterial) {
          console.log('\n⚠️  WARNING: Material exists but is soft-deleted or has deletedAt set');
          if (material.deletedAt) {
            console.log(`   Deleted at: ${material.deletedAt}`);
          } else if (material.deletedAt === null) {
            console.log('   deletedAt field is null, but query still fails - checking field type...');
            // Check if deletedAt field exists
            const materialFields = Object.keys(material);
            console.log(`   Available fields: ${materialFields.join(', ')}`);
            if (!materialFields.includes('deletedAt')) {
              console.log('   ⚠️  deletedAt field is missing from document!');
            }
          }
        } else {
          console.log('\n✅ Material is active and queryable');
        }
      }
    } else {
      // Show summary
      console.log('📊 Material Library Summary:\n');

      const total = await db.collection('material_library').countDocuments({});
      const active = await db.collection('material_library').countDocuments({ deletedAt: null });
      const deleted = await db.collection('material_library').countDocuments({ deletedAt: { $ne: null } });
      const withoutDeletedAt = await db.collection('material_library').countDocuments({
        deletedAt: { $exists: false }
      });

      console.log(`   Total materials: ${total}`);
      console.log(`   Active (deletedAt: null): ${active}`);
      console.log(`   Deleted (deletedAt set): ${deleted}`);
      console.log(`   Missing deletedAt field: ${withoutDeletedAt}`);

      // Sample materials
      console.log('\n📋 Sample Materials (first 5):');
      const samples = await db.collection('material_library')
        .find({})
        .limit(5)
        .toArray();

      samples.forEach((m, i) => {
        console.log(`\n   ${i + 1}. ${m.name}`);
        console.log(`      ID: ${m._id.toString()}`);
        console.log(`      deletedAt: ${m.deletedAt || 'null'}`);
        console.log(`      has deletedAt field: ${m.hasOwnProperty('deletedAt')}`);
      });
    }

    console.log('\n✅ Check complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

checkMaterialLibrary()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

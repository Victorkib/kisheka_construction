/**
 * Diagnostic Script: Material Index Issue
 * 
 * This script checks:
 * 1. Current indexes on materials collection
 * 2. Materials with null materialCode
 * 3. Duplicate projectId + materialCode combinations
 * 4. Recommendations for fixing the issue
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
const MONGODB_DB = process.env.MONGODB_DB || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function diagnoseMaterialIndex() {
  let client;
  
  try {
    console.log('🔍 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB);
    const materialsCollection = db.collection('materials');

    // 1. Check current indexes
    console.log('📋 Checking indexes on materials collection...');
    const indexes = await materialsCollection.indexes();
    console.log('\nCurrent Indexes:');
    indexes.forEach((index, i) => {
      console.log(`  ${i + 1}. ${index.name}:`, JSON.stringify(index.key, null, 2));
      if (index.unique) {
        console.log(`     ⚠️  UNIQUE INDEX`);
      }
    });

    // 2. Check for materials with null materialCode
    console.log('\n\n📊 Analyzing materials with null materialCode...');
    const nullMaterialCodeCount = await materialsCollection.countDocuments({
      $or: [
        { materialCode: null },
        { materialCode: { $exists: false } },
      ],
    });
    console.log(`   Total materials with null/missing materialCode: ${nullMaterialCodeCount}`);

    // 3. Check for duplicate projectId + null materialCode combinations
    console.log('\n🔍 Checking for duplicate projectId + null materialCode combinations...');
    const duplicates = await materialsCollection.aggregate([
      {
        $match: {
          $or: [
            { materialCode: null },
            { materialCode: { $exists: false } },
          ],
        },
      },
      {
        $group: {
          _id: '$projectId',
          count: { $sum: 1 },
          materialIds: { $push: '$_id' },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]).toArray();

    if (duplicates.length > 0) {
      console.log(`\n   ⚠️  Found ${duplicates.length} projects with multiple materials having null materialCode:`);
      duplicates.forEach((dup, i) => {
        console.log(`\n   ${i + 1}. Project ID: ${dup._id}`);
        console.log(`      Count: ${dup.count} materials`);
        console.log(`      Material IDs: ${dup.materialIds.slice(0, 5).map(id => id.toString()).join(', ')}${dup.materialIds.length > 5 ? '...' : ''}`);
      });
    } else {
      console.log('   ✅ No duplicate projectId + null materialCode combinations found');
    }

    // 4. Check total materials count
    const totalMaterials = await materialsCollection.countDocuments({});
    console.log(`\n\n📈 Total materials in collection: ${totalMaterials}`);

    // 5. Sample materials to see structure
    console.log('\n📄 Sample materials (first 3):');
    const samples = await materialsCollection.find({}).limit(3).toArray();
    samples.forEach((material, i) => {
      console.log(`\n   Material ${i + 1}:`);
      console.log(`      _id: ${material._id}`);
      console.log(`      projectId: ${material.projectId}`);
      console.log(`      materialCode: ${material.materialCode ?? 'null/undefined'}`);
      console.log(`      name: ${material.name || material.materialName || 'N/A'}`);
      console.log(`      status: ${material.status || 'N/A'}`);
    });

    // 6. Check if materialCode field exists in any materials
    const hasMaterialCode = await materialsCollection.countDocuments({
      materialCode: { $exists: true, $ne: null },
    });
    console.log(`\n\n📊 Materials with materialCode set: ${hasMaterialCode}`);
    console.log(`   Materials without materialCode: ${totalMaterials - hasMaterialCode}`);

    // 7. Check if sparse index exists
    const sparseIndex = indexes.find(idx => 
      idx.name === 'project_materialCode_unique_sparse' && idx.sparse === true
    );
    const oldIndex = indexes.find(idx => idx.name === 'project_materialCode_unique' && !idx.sparse);

    // 8. Recommendations
    console.log('\n\n💡 STATUS & RECOMMENDATIONS:');
    
    if (sparseIndex) {
      console.log('\n   ✅ GOOD: Sparse unique index is correctly configured!');
      console.log('      - Multiple materials with null materialCode per project are allowed');
      console.log('      - Materials with materialCode set are still unique per project');
      console.log('      - No action needed - system is working correctly');
    } else if (oldIndex) {
      console.log('\n   ⚠️  ISSUE: Non-sparse unique index detected');
      console.log('      - This will prevent multiple materials with null materialCode');
      console.log('      - Run fix-material-index.mjs to migrate to sparse index');
    } else {
      console.log('\n   ℹ️  No unique index on { projectId, materialCode } found');
      console.log('      - Consider creating sparse unique index if materialCode uniqueness is desired');
    }
    
    if (!sparseIndex && (oldIndex || !indexes.find(idx => idx.name?.includes('materialCode')))) {
      console.log('\n   Solutions:');
      console.log('   1. Run: node scripts/fix-material-index.mjs (recommended)');
      console.log('   2. Auto-generate materialCode for all materials');
      console.log('   3. Remove materialCode from unique index if not needed');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n✅ Connection closed');
    }
  }
}

diagnoseMaterialIndex()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnosis failed:', error);
    process.exit(1);
  });


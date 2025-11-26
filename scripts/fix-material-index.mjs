/**
 * Fix Material Index - Migration Script
 * 
 * This script fixes the duplicate key error by:
 * 1. Dropping the existing unique index on { projectId, materialCode }
 * 2. Creating a new sparse unique index that allows multiple null materialCode values
 * 
 * IMPORTANT: Run this script to fix the E11000 duplicate key error
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

async function fixMaterialIndex() {
  let client;
  
  try {
    console.log('🔍 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB);
    const materialsCollection = db.collection('materials');

    // Step 1: Check current indexes
    console.log('📋 Step 1: Checking current indexes...');
    const indexes = await materialsCollection.indexes();
    const existingIndex = indexes.find(idx => idx.name === 'project_materialCode_unique');
    
    if (!existingIndex) {
      console.log('   ⚠️  Index "project_materialCode_unique" not found');
      console.log('   ℹ️  Creating sparse index anyway...\n');
    } else {
      console.log('   ✅ Found existing index: project_materialCode_unique');
      console.log('   Index details:', JSON.stringify(existingIndex.key, null, 2));
      console.log('   Unique:', existingIndex.unique);
      console.log('   Sparse:', existingIndex.sparse || false, '\n');
    }

    // Step 2: Drop existing index (if it exists)
    console.log('📋 Step 2: Dropping existing index...');
    try {
      await materialsCollection.dropIndex('project_materialCode_unique');
      console.log('   ✅ Successfully dropped index: project_materialCode_unique\n');
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('   ℹ️  Index does not exist (may have been dropped already)\n');
      } else {
        throw error;
      }
    }

    // Step 3: Create new sparse unique index
    console.log('📋 Step 3: Creating sparse unique index...');
    await materialsCollection.createIndex(
      { projectId: 1, materialCode: 1 },
      {
        unique: true,
        sparse: true, // Only index documents where materialCode exists and is not null
        name: 'project_materialCode_unique_sparse',
        background: true, // Create in background to avoid blocking
      }
    );
    console.log('   ✅ Successfully created sparse unique index: project_materialCode_unique_sparse\n');

    // Step 4: Verify index creation
    console.log('📋 Step 4: Verifying index creation...');
    const newIndexes = await materialsCollection.indexes();
    const newIndex = newIndexes.find(idx => idx.name === 'project_materialCode_unique_sparse');
    
    if (newIndex) {
      console.log('   ✅ Index verified:');
      console.log('      Name:', newIndex.name);
      console.log('      Keys:', JSON.stringify(newIndex.key, null, 2));
      console.log('      Unique:', newIndex.unique);
      console.log('      Sparse:', newIndex.sparse);
      console.log('');
    } else {
      throw new Error('Failed to verify index creation');
    }

    // Step 5: Test the index with sample queries
    console.log('📋 Step 5: Testing index behavior...');
    
    // Count materials with null materialCode
    const nullCount = await materialsCollection.countDocuments({
      $or: [
        { materialCode: null },
        { materialCode: { $exists: false } },
      ],
    });
    console.log(`   Materials with null materialCode: ${nullCount}`);
    
    // Count materials with materialCode set
    const withCodeCount = await materialsCollection.countDocuments({
      materialCode: { $exists: true, $ne: null },
    });
    console.log(`   Materials with materialCode set: ${withCodeCount}`);
    
    // Check for duplicate projectId + null combinations (should be allowed now)
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
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ]).toArray();
    
    if (duplicates.length > 0) {
      console.log(`   ✅ Found ${duplicates.length} projects with multiple null materialCode (this is now allowed)`);
    } else {
      console.log('   ✅ No duplicate projectId + null combinations (or only one material per project)');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - Old index (project_materialCode_unique) has been dropped');
    console.log('   - New sparse index (project_materialCode_unique_sparse) has been created');
    console.log('   - Multiple materials with null materialCode per project are now allowed');
    console.log('   - Materials with materialCode set will still be unique per project');
    console.log('\n🎉 You can now create multiple materials for the same project!');

  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    console.error('\n⚠️  If migration failed, you may need to manually fix the index.');
    console.error('   Check MongoDB Atlas or your MongoDB client for index status.');
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n✅ Connection closed');
    }
  }
}

// Run migration
fixMaterialIndex()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });


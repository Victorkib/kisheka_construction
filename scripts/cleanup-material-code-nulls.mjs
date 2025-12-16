/**
 * Cleanup Material Code Null Values
 * 
 * This script removes materialCode field from materials where it's null
 * to ensure the partial index works correctly
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

async function cleanupMaterialCodes() {
  let client;
  
  try {
    console.log('🧹 Cleaning up materialCode null values...\n');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB);
    const materialsCollection = db.collection('materials');
    
    // Find materials with materialCode = null or undefined
    const materialsWithNullCode = await materialsCollection.find({
      $or: [
        { materialCode: null },
        { materialCode: { $exists: false } },
      ]
    }).toArray();
    
    console.log(`Found ${materialsWithNullCode.length} materials with null/missing materialCode`);
    
    if (materialsWithNullCode.length > 0) {
      // Remove materialCode field from these documents
      // Process each document individually to ensure field is removed
      let modifiedCount = 0;
      for (const material of materialsWithNullCode) {
        const result = await materialsCollection.updateOne(
          { _id: material._id },
          { $unset: { materialCode: '' } }
        );
        if (result.modifiedCount > 0) {
          modifiedCount++;
        }
      }
      
      console.log(`✅ Removed materialCode field from ${modifiedCount} materials`);
    } else {
      console.log('✅ No materials with null materialCode found');
    }
    
    // Verify
    const remainingNulls = await materialsCollection.countDocuments({
      materialCode: null
    });
    
    if (remainingNulls === 0) {
      console.log('✅ Verification: No materials with null materialCode remaining');
    } else {
      console.log(`⚠️  Warning: ${remainingNulls} materials still have null materialCode`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

cleanupMaterialCodes()
  .then(() => {
    console.log('\n✅ Cleanup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });


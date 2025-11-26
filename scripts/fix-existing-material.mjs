/**
 * Fix Existing Material - Remove materialCode if null
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'kisheka_prod';

async function fixExistingMaterial() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB);
    const materialsCollection = db.collection('materials');
    
    // Get all materials
    const materials = await materialsCollection.find({}).toArray();
    
    console.log(`Found ${materials.length} materials\n`);
    
    for (const material of materials) {
      console.log(`Material ID: ${material._id}`);
      console.log(`  materialCode: ${JSON.stringify(material.materialCode)}`);
      console.log(`  materialCode type: ${typeof material.materialCode}`);
      console.log(`  has materialCode: ${material.hasOwnProperty('materialCode')}`);
      
      // If materialCode is null or undefined, remove it
      if (material.materialCode === null || material.materialCode === undefined) {
        const result = await materialsCollection.updateOne(
          { _id: material._id },
          { $unset: { materialCode: '' } }
        );
        console.log(`  ✅ Removed materialCode field (modified: ${result.modifiedCount})`);
      } else {
        console.log(`  ℹ️  materialCode has value, keeping it`);
      }
      console.log('');
    }
    
    // Verify
    const remaining = await materialsCollection.find({
      materialCode: null
    }).toArray();
    
    console.log(`\nVerification: ${remaining.length} materials still have null materialCode`);
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

fixExistingMaterial()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });


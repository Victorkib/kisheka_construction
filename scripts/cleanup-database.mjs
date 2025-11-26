/**
 * Database Cleanup Script
 * Drops all collections to start fresh
 * 
 * WARNING: This will delete ALL data! Only use for development!
 * 
 * Run with: node scripts/cleanup-database.mjs
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
const DB_NAME = process.env.MONGODB_DB_NAME || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

async function cleanupDatabase() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    console.log('⚠️  WARNING: This will delete ALL collections and data!\n');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections to drop:\n`);
    
    for (const collection of collections) {
      console.log(`   Dropping collection: ${collection.name}...`);
      await db.collection(collection.name).drop();
      console.log(`   ✅ Dropped: ${collection.name}`);
    }
    
    console.log('\n✅ All collections dropped successfully!');
    console.log('📝 You can now run the setup script to recreate everything.\n');
    
  } catch (error) {
    if (error.code === 26 || error.codeName === 'NamespaceNotFound') {
      console.log('   ℹ️  Collection does not exist (already dropped)');
    } else {
      console.error('❌ Cleanup error:', error);
      throw error;
    }
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the cleanup
cleanupDatabase()
  .then(() => {
    console.log('\n✅ Cleanup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup script failed:', error);
    process.exit(1);
  });


/**
 * MongoDB Connection Test Script
 * Tests the MongoDB connection and verifies database access
 * 
 * Run with: node scripts/test-connection.mjs
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

async function testConnection() {
  let client;
  
  try {
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in .env.local');
      console.log('💡 Please copy env.example to .env.local and fill in your MongoDB connection string');
      process.exit(1);
    }

    console.log('🔌 Testing MongoDB connection...\n');
    console.log(`📍 Database: ${DB_NAME}`);
    console.log(`🔗 URI: ${MONGODB_URI.replace(/:[^:@]+@/, ':****@')}\n`); // Hide password
    
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    
    await client.connect();
    console.log('✅ Successfully connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // Test ping
    await db.admin().ping();
    console.log('✅ Database ping successful');
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`\n📦 Collections in database: ${collections.length}`);
    if (collections.length > 0) {
      collections.forEach(col => {
        console.log(`   • ${col.name}`);
      });
    } else {
      console.log('   (No collections found - run setup-database.mjs to create them)');
    }
    
    // Test write operation
    const testCollection = db.collection('_connection_test');
    const testDoc = {
      test: true,
      timestamp: new Date(),
    };
    await testCollection.insertOne(testDoc);
    console.log('✅ Write operation successful');
    
    // Clean up test document
    await testCollection.deleteOne({ _id: testDoc._id });
    console.log('✅ Cleanup successful');
    
    console.log('\n🎉 All connection tests passed!');
    console.log('💡 Next step: Run "npm run setup:db" to create collections and indexes');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    if (error.message.includes('authentication')) {
      console.error('   → Check your MongoDB username and password');
    } else if (error.message.includes('timeout')) {
      console.error('   → Check your network connection and MongoDB cluster IP whitelist');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('   → Check your MongoDB connection string (cluster URL)');
    } else {
      console.error(`   → ${error.message}`);
    }
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Connection closed');
    }
  }
}

testConnection();


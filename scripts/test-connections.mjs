/**
 * Connection Test Script
 * Tests all external service connections (MongoDB, Supabase, Cloudinary)
 * Run with: npm run test:connections
 */

import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import cloudinary from 'cloudinary';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

async function testConnections() {
  console.log('🔍 Testing Kisheka System Connections...\n');

  // Test MongoDB
  console.log('1️⃣  Testing MongoDB...');
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const dbName = process.env.MONGODB_DB_NAME || 'kisheka_prod';
    const db = client.db(dbName);

    const collections = await db.listCollections().toArray();
    console.log(`✅ MongoDB: ${collections.length} collections found\n`);

    collections.forEach((col) => console.log(`   • ${col.name}`));
    await client.close();
  } catch (error) {
    console.error(`❌ MongoDB error: ${error.message}\n`);
    // Don't exit - continue testing other services
  }

  // Test Supabase
  console.log('2️⃣  Testing Supabase...');
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not found in environment variables');
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers({ limit: 1 });

    if (error) {
      throw error;
    }

    console.log(`✅ Supabase: Connected (${users.length} user(s) found)\n`);
  } catch (error) {
    console.error(`❌ Supabase error: ${error.message}\n`);
  }

  // Test Cloudinary
  console.log('3️⃣  Testing Cloudinary...');
  try {
    if (
      !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error('Cloudinary credentials not found in environment variables');
    }

    cloudinary.v2.config({
      cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Test connection by listing resources
    await cloudinary.v2.api.resources({ max_results: 1 });
    console.log(`✅ Cloudinary: Connected\n`);
  } catch (error) {
    console.error(`❌ Cloudinary error: ${error.message}\n`);
  }

  console.log('✅ All connection tests completed!');
  console.log('\n💡 Next steps:');
  console.log('   1. Ensure all environment variables are set in .env.local');
  console.log('   2. Run "npm run setup:db" to create database collections');
  console.log('   3. Start dev server with "npm run dev"');
}

testConnections().catch((error) => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});


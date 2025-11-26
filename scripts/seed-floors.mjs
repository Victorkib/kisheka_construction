/**
 * Seed Floors Script
 * Populates the floors collection with 10 floors (Ground + 9 upper floors)
 * 
 * Run with: node scripts/seed-floors.mjs
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

// Generate floors: Ground (0) + Floors 1-9
const defaultFloors = [];
for (let i = 0; i <= 9; i++) {
  const floorNumber = i;
  const floorName = i === 0 ? 'Ground Floor' : `Floor ${i}`;
  
  defaultFloors.push({
    floorNumber,
    name: floorName,
    description: `${floorName} of the 10-storey building`,
    status: 'NOT_STARTED',
    startDate: null,
    completionDate: null,
    totalBudget: 0,
    actualCost: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function seedFloors() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    console.log('🌱 Seeding floors...\n');
    
    const floorsCollection = db.collection('floors');
    
    // Check if floors already exist
    const existingCount = await floorsCollection.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Floors collection already has ${existingCount} floors.`);
      console.log('   To re-seed, delete existing floors first.\n');
      return;
    }
    
    // Insert floors
    const result = await floorsCollection.insertMany(defaultFloors);
    
    console.log(`✅ Successfully seeded ${result.insertedCount} floors:\n`);
    defaultFloors.forEach((floor) => {
      console.log(`   • ${floor.name} (Floor ${floor.floorNumber}) - ${floor.status}`);
    });
    
    console.log('\n🎉 Floors seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Floors seeding error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Run the seed
seedFloors()
  .then(() => {
    console.log('\n✅ Seed script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed script failed:', error);
    process.exit(1);
  });


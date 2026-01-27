/**
 * Seed Floors Script
 * Populates the floors collection with 10 floors (Ground + 9 upper floors)
 * 
 * Run with: node scripts/seed-floors.mjs
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
const DB_NAME = process.env.MONGODB_DB_NAME || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
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
    const projectsCollection = db.collection('projects');
    
    const projectCode = process.env.SEED_FLOORS_PROJECT_CODE || 'KISHEKA-001';
    let project = await projectsCollection.findOne({ projectCode });
    
    if (!project) {
      project = await projectsCollection.findOne({}, { sort: { createdAt: 1 } });
    }
    
    if (!project) {
      console.error('❌ No project found. Create a project first, then re-run this script.');
      process.exit(1);
    }
    
    const projectId = new ObjectId(project._id);
    const projectName = project.projectName || 'the building';
    
    // Check if floors already exist for this project
    const existingCount = await floorsCollection.countDocuments({
      projectId: projectId,
    });
    if (existingCount > 0) {
      console.log(`⚠️  Project already has ${existingCount} floors.`);
      console.log('   To re-seed, delete existing floors for this project first.\n');
      return;
    }
    
    // Generate floors: Ground (0) + Floors 1-9
    const defaultFloors = [];
    for (let i = 0; i <= 9; i++) {
      const floorNumber = i;
      const floorName = i === 0 ? 'Ground Floor' : `Floor ${i}`;
      
      defaultFloors.push({
        projectId: projectId,
        floorNumber,
        name: floorName,
        description: `${floorName} of ${projectName}`,
        status: 'NOT_STARTED',
        startDate: null,
        completionDate: null,
        totalBudget: 0,
        actualCost: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
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


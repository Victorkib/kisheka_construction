/**
 * Seed Default Project Script
 * Creates a default project for the Kisheka Construction system
 * 
 * Run with: node scripts/seed-default-project.mjs
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

const defaultProject = {
  projectCode: 'KISHEKA-001',
  projectName: 'Kisheka 10-Storey Building',
  description: '10-storey residential/commercial building construction project',
  location: 'Nairobi, Kenya',
  client: 'Kisheka Construction Ltd',
  status: 'active',
  startDate: new Date(),
  plannedEndDate: null, // To be set by project manager
  actualEndDate: null,
  budget: {
    total: 0, // To be set by project manager
    materials: 0,
    labour: 0,
    contingency: 0,
    spent: 0,
  },
  siteManager: null,
  teamMembers: [],
  createdBy: null, // Will be set if a user exists
  createdAt: new Date(),
  updatedAt: new Date(),
  documents: [],
  metadata: {
    contractValue: 0,
    estimatedDuration: null,
    completionPercentage: 0,
  },
};

async function seedDefaultProject() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    console.log('🌱 Seeding default project...\n');
    
    const projectsCollection = db.collection('projects');
    
    // Check if default project already exists
    const existing = await projectsCollection.findOne({
      projectCode: defaultProject.projectCode,
    });
    
    if (existing) {
      console.log(`⚠️  Project with code "${defaultProject.projectCode}" already exists.`);
      console.log(`   Project ID: ${existing._id}`);
      console.log('   To re-seed, delete the existing project first.\n');
      return existing._id;
    }
    
    // Try to get first user to set as createdBy
    const usersCollection = db.collection('users');
    const firstUser = await usersCollection.findOne({}, { sort: { createdAt: 1 } });
    if (firstUser) {
      defaultProject.createdBy = firstUser._id;
      console.log(`✅ Found user: ${firstUser.email} - will be set as project creator`);
    }
    
    // Insert project
    const result = await projectsCollection.insertOne(defaultProject);
    
    console.log(`✅ Successfully created default project:`);
    console.log(`   • Code: ${defaultProject.projectCode}`);
    console.log(`   • Name: ${defaultProject.projectName}`);
    console.log(`   • ID: ${result.insertedId}`);
    console.log('\n🎉 Default project seeding completed successfully!');
    console.log(`\n💡 Use this Project ID in your materials: ${result.insertedId}`);
    
    return result.insertedId;
  } catch (error) {
    console.error('❌ Default project seeding error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Run the seed
seedDefaultProject()
  .then((projectId) => {
    console.log('\n✅ Seed script completed');
    if (projectId) {
      console.log(`\n📋 Project ID to use: ${projectId}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed script failed:', error);
    process.exit(1);
  });


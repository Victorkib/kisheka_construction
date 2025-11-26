/**
 * Seed Categories Script
 * Populates the categories collection with default construction categories
 * 
 * Run with: node scripts/seed-categories.mjs
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

const defaultCategories = [
  {
    name: 'Structural Materials',
    description: 'Cement, steel, concrete, aggregates, and other structural components',
    subcategories: ['Cement', 'Steel Bars', 'Concrete', 'Aggregates', 'Reinforcement'],
    icon: '🏗️',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Masonry',
    description: 'Blocks, bricks, precast elements, and masonry materials',
    subcategories: ['Blocks', 'Bricks', 'Precast Elements'],
    icon: '🧱',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Electrical Works',
    description: 'Electrical materials, wiring, fixtures, and equipment',
    subcategories: ['Wires & Cables', 'Switches & Sockets', 'Lighting Fixtures', 'Electrical Panels', 'Conduits'],
    icon: '⚡',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Plumbing Works',
    description: 'Pipes, fittings, fixtures, and plumbing equipment',
    subcategories: ['Pipes', 'Fittings', 'Fixtures', 'Water Heaters', 'Pumps'],
    icon: '🚿',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Joinery/Carpentry',
    description: 'Woodwork, doors, windows, and carpentry materials',
    subcategories: ['Doors', 'Windows', 'Frames', 'Timber', 'Hardware'],
    icon: '🪵',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Paintwork',
    description: 'Paints, primers, brushes, and painting supplies',
    subcategories: ['Interior Paint', 'Exterior Paint', 'Primer', 'Brushes & Rollers', 'Thinners'],
    icon: '🎨',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Tiling & Terrazzo',
    description: 'Tiles, adhesives, grout, and terrazzo materials',
    subcategories: ['Floor Tiles', 'Wall Tiles', 'Adhesives', 'Grout', 'Terrazzo'],
    icon: '🧱',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Lift Installation',
    description: 'Elevator components, installation materials, and related equipment',
    subcategories: ['Lift Car', 'Motor & Controls', 'Cables', 'Installation Materials'],
    icon: '🛗',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function seedCategories() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    console.log('🌱 Seeding categories...\n');
    
    const categoriesCollection = db.collection('categories');
    
    // Check if categories already exist
    const existingCount = await categoriesCollection.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Categories collection already has ${existingCount} categories.`);
      console.log('   To re-seed, delete existing categories first.\n');
      return;
    }
    
    // Insert categories
    const result = await categoriesCollection.insertMany(defaultCategories);
    
    console.log(`✅ Successfully seeded ${result.insertedCount} categories:\n`);
    defaultCategories.forEach((cat, index) => {
      console.log(`   ${index + 1}. ${cat.icon} ${cat.name}`);
    });
    
    console.log('\n🎉 Categories seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Categories seeding error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Run the seed
seedCategories()
  .then(() => {
    console.log('\n✅ Seed script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed script failed:', error);
    process.exit(1);
  });


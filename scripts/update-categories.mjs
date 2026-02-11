/**
 * Update Categories Script
 * Adds missing categories to existing database without deleting or modifying existing ones
 * Safe to run multiple times - only adds categories that don't already exist
 * 
 * Run with: node scripts/update-categories.mjs
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

// Import category constants to ensure type is set correctly
const CATEGORY_TYPES = {
  MATERIALS: 'materials',
  WORK_ITEMS: 'work_items',
};

// Same categories as seed-categories.mjs - keep in sync!
const defaultCategories = [
  {
    name: 'Structural Materials',
    description: 'Cement, steel, concrete, aggregates, reinforcement, and other core structural components',
    subcategories: ['Cement', 'Steel Bars', 'Concrete', 'Aggregates', 'Reinforcement', 'Formwork'],
    icon: '🏗️',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Substructure & Foundations',
    description: 'Excavation, footing, foundation walls, and related works below ground level',
    subcategories: ['Excavation', 'Blinding', 'Footings', 'Foundation Walls', 'Backfilling'],
    icon: '🕳️',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Masonry',
    description: 'Blocks, bricks, precast elements, and masonry accessories',
    subcategories: ['Blocks', 'Bricks', 'Precast Elements', 'Lintels', 'Mortar'],
    icon: '🧱',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Roofing',
    description: 'Roof structure, coverings, water proofing, and roof accessories',
    subcategories: ['Roof Trusses', 'Roof Sheets & Tiles', 'Waterproofing', 'Gutters & Downpipes', 'Roof Accessories'],
    icon: '🏠',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Electrical Works',
    description: 'Electrical materials, wiring, fixtures, and equipment',
    subcategories: ['Wires & Cables', 'Switches & Sockets', 'Lighting Fixtures', 'Electrical Panels', 'Conduits'],
    icon: '⚡',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Plumbing Works',
    description: 'Pipes, fittings, fixtures, and plumbing equipment',
    subcategories: ['Pipes', 'Fittings', 'Fixtures', 'Water Heaters', 'Pumps'],
    icon: '🚿',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Mechanical & HVAC',
    description: 'Mechanical ventilation, air conditioning, and related mechanical services',
    subcategories: ['Ducting', 'AC Units', 'Fans & Ventilation', 'Chillers', 'Controls & Accessories'],
    icon: '🌬️',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Joinery/Carpentry',
    description: 'Woodwork, doors, windows, ceilings, and carpentry materials',
    subcategories: ['Doors', 'Windows', 'Frames', 'Timber', 'Hardware', 'Ceilings'],
    icon: '🪵',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Metalwork & Fabrication',
    description: 'Grills, rails, balustrades, gates, and custom metal fabrications',
    subcategories: ['Balustrades', 'Grills', 'Handrails', 'Gates', 'Custom Fabrication'],
    icon: '🛠️',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Paintwork & Wall Finishes',
    description: 'Paints, primers, plaster, skim coats, and decorative finishes',
    subcategories: ['Interior Paint', 'Exterior Paint', 'Primer', 'Plaster & Skim', 'Special Finishes'],
    icon: '🎨',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Floor & Wall Tiling',
    description: 'Tiles, adhesives, grout, terrazzo, and related accessories',
    subcategories: ['Floor Tiles', 'Wall Tiles', 'Adhesives', 'Grout', 'Terrazzo'],
    icon: '🧱',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Ceilings & Partitions',
    description: 'Gypsum boards, suspension systems, and partition materials',
    subcategories: ['Gypsum Boards', 'Suspension Systems', 'Acoustic Panels', 'Metal Studs', 'Accessories'],
    icon: '🧩',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'External Works & Landscaping',
    description: 'Paving, fencing, driveways, soft and hard landscaping',
    subcategories: ['Paving Blocks', 'Kerbs', 'Fencing', 'Driveways', 'Soft Landscaping'],
    icon: '🌳',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Lift Installation',
    description: 'Elevator components, installation materials, and related equipment',
    subcategories: ['Lift Car', 'Motor & Controls', 'Cables', 'Installation Materials'],
    icon: '🛗',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Safety & Site Logistics',
    description: 'Safety gear, signage, scaffolding, and temporary works',
    subcategories: ['PPE', 'Safety Signage', 'Scaffolding', 'Barricades', 'Temporary Works'],
    icon: '⚠️',
    type: CATEGORY_TYPES.MATERIALS,
  },
  {
    name: 'Fixtures & Fittings',
    description: 'Sanitary ware, ironmongery, kitchen and wardrobe fittings',
    subcategories: ['Sanitary Ware', 'Ironmongery', 'Kitchen Fittings', 'Wardrobe Fittings', 'Accessories'],
    icon: '🚽',
    type: CATEGORY_TYPES.MATERIALS,
  },
];

async function updateCategories() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    console.log('🔄 Updating categories (adding missing ones only)...\n');
    
    const categoriesCollection = db.collection('categories');
    
    // Get existing categories by name and type
    const existingCategories = await categoriesCollection.find({}).toArray();
    const existingMap = new Map();
    existingCategories.forEach((cat) => {
      const key = `${cat.name.toLowerCase().trim()}_${cat.type || CATEGORY_TYPES.MATERIALS}`;
      existingMap.set(key, cat);
    });
    
    console.log(`📊 Found ${existingCategories.length} existing categories\n`);
    
    // Find missing categories
    const categoriesToAdd = [];
    const skipped = [];
    
    for (const category of defaultCategories) {
      const key = `${category.name.toLowerCase().trim()}_${category.type}`;
      if (existingMap.has(key)) {
        skipped.push(category.name);
      } else {
        categoriesToAdd.push({
          ...category,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
    
    if (skipped.length > 0) {
      console.log(`⏭️  Skipping ${skipped.length} existing categories:`);
      skipped.forEach((name) => {
        console.log(`   - ${name}`);
      });
      console.log('');
    }
    
    if (categoriesToAdd.length === 0) {
      console.log('✅ All categories already exist. Nothing to add.\n');
      return;
    }
    
    console.log(`➕ Adding ${categoriesToAdd.length} new categories:\n`);
    
    // Insert missing categories one by one (to handle potential duplicates gracefully)
    let addedCount = 0;
    let errorCount = 0;
    
    for (const category of categoriesToAdd) {
      try {
        // Double-check it doesn't exist (case-insensitive name + type check)
        const existing = await categoriesCollection.findOne({
          name: { $regex: new RegExp(`^${category.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          $or: [
            { type: category.type },
            { type: { $exists: false } }, // Handle legacy categories without type
          ],
        });
        
        if (existing) {
          console.log(`   ⚠️  "${category.name}" already exists (skipping)`);
          continue;
        }
        
        await categoriesCollection.insertOne(category);
        console.log(`   ✅ ${category.icon} ${category.name}`);
        addedCount++;
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error (unique index violation)
          console.log(`   ⚠️  "${category.name}" already exists (duplicate key, skipping)`);
        } else {
          console.error(`   ❌ Error adding "${category.name}":`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Added: ${addedCount} categories`);
    if (skipped.length > 0) {
      console.log(`   ⏭️  Skipped: ${skipped.length} existing categories`);
    }
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount} categories`);
    }
    
    console.log('\n🎉 Category update completed!');
    
  } catch (error) {
    console.error('❌ Category update error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Run the update
updateCategories()
  .then(() => {
    console.log('\n✅ Update script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Update script failed:', error);
    process.exit(1);
  });

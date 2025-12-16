#!/usr/bin/env node

/**
 * Seed Material Library Script
 * Populates the material library with common construction materials
 * 
 * Run with: node scripts/seed-material-library.mjs
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

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

const commonMaterials = [
  {
    name: 'Cement (50kg bag)',
    description: 'Portland cement in 50kg bags',
    category: 'Structural Materials',
    defaultUnit: 'bag',
    defaultUnitCost: 850,
    isCommon: true,
    specifications: 'Grade 42.5',
  },
  {
    name: 'Steel Rebars (12mm)',
    description: 'Reinforcement steel bars, 12mm diameter',
    category: 'Structural Materials',
    defaultUnit: 'piece',
    defaultUnitCost: 1200,
    isCommon: true,
    specifications: '12mm diameter, 6m length',
  },
  {
    name: 'Steel Rebars (16mm)',
    description: 'Reinforcement steel bars, 16mm diameter',
    category: 'Structural Materials',
    defaultUnit: 'piece',
    defaultUnitCost: 1800,
    isCommon: true,
    specifications: '16mm diameter, 6m length',
  },
  {
    name: 'Sand',
    description: 'Construction sand',
    category: 'Structural Materials',
    defaultUnit: 'lorry',
    defaultUnitCost: 20000,
    isCommon: true,
  },
  {
    name: 'Gravel/Aggregate',
    description: 'Crushed stone aggregate',
    category: 'Structural Materials',
    defaultUnit: 'ton',
    defaultUnitCost: 3500,
    isCommon: true,
  },
  {
    name: 'Hardcore',
    description: 'Hardcore for foundation',
    category: 'Structural Materials',
    defaultUnit: 'lorry',
    defaultUnitCost: 18000,
    isCommon: true,
  },
  {
    name: 'Concrete Blocks (6 inch)',
    description: 'Standard 6 inch concrete blocks',
    category: 'Structural Materials',
    defaultUnit: 'piece',
    defaultUnitCost: 45,
    isCommon: true,
  },
  {
    name: 'Concrete Blocks (9 inch)',
    description: 'Standard 9 inch concrete blocks',
    category: 'Structural Materials',
    defaultUnit: 'piece',
    defaultUnitCost: 65,
    isCommon: true,
  },
  {
    name: 'River Sand',
    description: 'Fine river sand for plastering',
    category: 'Structural Materials',
    defaultUnit: 'lorry',
    defaultUnitCost: 22000,
    isCommon: true,
  },
  {
    name: 'Ballast',
    description: 'Ballast for concrete mixing',
    category: 'Structural Materials',
    defaultUnit: 'ton',
    defaultUnitCost: 3200,
    isCommon: true,
  },
  {
    name: 'Binding Wire',
    description: 'Wire for tying rebars',
    category: 'Structural Materials',
    defaultUnit: 'kg',
    defaultUnitCost: 450,
    isCommon: true,
  },
  {
    name: 'PVC Pipes (1 inch)',
    description: 'PVC water pipes, 1 inch diameter',
    category: 'Plumbing',
    defaultUnit: 'meter',
    defaultUnitCost: 250,
    isCommon: true,
  },
  {
    name: 'PVC Pipes (2 inch)',
    description: 'PVC water pipes, 2 inch diameter',
    category: 'Plumbing',
    defaultUnit: 'meter',
    defaultUnitCost: 450,
    isCommon: true,
  },
  {
    name: 'GI Pipes (1 inch)',
    description: 'Galvanized iron pipes, 1 inch',
    category: 'Plumbing',
    defaultUnit: 'meter',
    defaultUnitCost: 800,
    isCommon: true,
  },
  {
    name: 'Copper Wire (2.5mm)',
    description: 'Electrical copper wire, 2.5mm',
    category: 'Electrical',
    defaultUnit: 'meter',
    defaultUnitCost: 120,
    isCommon: true,
  },
  {
    name: 'Copper Wire (4mm)',
    description: 'Electrical copper wire, 4mm',
    category: 'Electrical',
    defaultUnit: 'meter',
    defaultUnitCost: 180,
    isCommon: true,
  },
  {
    name: 'Conduit Pipes (20mm)',
    description: 'Electrical conduit pipes',
    category: 'Electrical',
    defaultUnit: 'meter',
    defaultUnitCost: 150,
    isCommon: true,
  },
  {
    name: 'Switch Sockets',
    description: 'Electrical switch sockets',
    category: 'Electrical',
    defaultUnit: 'piece',
    defaultUnitCost: 350,
    isCommon: true,
  },
  {
    name: 'Circuit Breakers',
    description: 'Electrical circuit breakers',
    category: 'Electrical',
    defaultUnit: 'piece',
    defaultUnitCost: 2500,
    isCommon: true,
  },
  {
    name: 'Paint (20L)',
    description: 'Emulsion paint, 20 liter',
    category: 'Finishing',
    defaultUnit: 'gallon',
    defaultUnitCost: 4500,
    isCommon: true,
  },
  {
    name: 'Paint Primer',
    description: 'Paint primer',
    category: 'Finishing',
    defaultUnit: 'gallon',
    defaultUnitCost: 3500,
    isCommon: true,
  },
  {
    name: 'Tiles (30x30cm)',
    description: 'Ceramic floor tiles',
    category: 'Finishing',
    defaultUnit: 'square meter',
    defaultUnitCost: 1200,
    isCommon: true,
  },
  {
    name: 'Tiles (60x60cm)',
    description: 'Ceramic floor tiles, large format',
    category: 'Finishing',
    defaultUnit: 'square meter',
    defaultUnitCost: 2500,
    isCommon: true,
  },
  {
    name: 'Roofing Sheets (Corrugated)',
    description: 'Corrugated iron roofing sheets',
    category: 'Roofing',
    defaultUnit: 'sheet',
    defaultUnitCost: 3500,
    isCommon: true,
  },
  {
    name: 'Roofing Nails',
    description: 'Nails for roofing',
    category: 'Roofing',
    defaultUnit: 'kg',
    defaultUnitCost: 280,
    isCommon: true,
  },
  {
    name: 'Timber (2x4)',
    description: 'Timber planks, 2x4 inches',
    category: 'Timber',
    defaultUnit: 'meter',
    defaultUnitCost: 450,
    isCommon: true,
  },
  {
    name: 'Plywood (4x8)',
    description: 'Plywood sheets, 4x8 feet',
    category: 'Timber',
    defaultUnit: 'sheet',
    defaultUnitCost: 3500,
    isCommon: true,
  },
  {
    name: 'Nails (3 inch)',
    description: 'Common nails, 3 inch',
    category: 'Hardware',
    defaultUnit: 'kg',
    defaultUnitCost: 320,
    isCommon: true,
  },
  {
    name: 'Screws (3 inch)',
    description: 'Wood screws, 3 inch',
    category: 'Hardware',
    defaultUnit: 'kg',
    defaultUnitCost: 850,
    isCommon: true,
  },
];

async function seedMaterialLibrary() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB);
    
    console.log('🌱 Starting material library seed...\n');
    
    // Get categories to map names to IDs
    const categories = await db.collection('categories').find({}).toArray();
    const categoryMap = new Map();
    categories.forEach(cat => {
      categoryMap.set(cat.name?.toLowerCase(), cat._id);
    });
    
    // Check existing materials to avoid duplicates
    const existingMaterials = await db.collection('material_library')
      .find({ deletedAt: null })
      .toArray();
    const existingNames = new Set(
      existingMaterials.map(m => m.name?.toLowerCase())
    );
    
    // Prepare materials for insertion
    const materialsToInsert = commonMaterials
      .filter(m => !existingNames.has(m.name.toLowerCase()))
      .map(m => {
        const categoryId = categoryMap.get(m.category?.toLowerCase());
        
        return {
          name: m.name,
          description: m.description || '',
          categoryId: categoryId || null,
          category: m.category || 'other',
          defaultUnit: m.defaultUnit,
          defaultUnitCost: m.defaultUnitCost || null,
          materialCode: null,
          brand: null,
          specifications: m.specifications || null,
          usageCount: 0,
          lastUsedAt: null,
          lastUsedBy: null,
          isActive: true,
          isCommon: m.isCommon || false,
          createdBy: null, // Will be set by OWNER when they use it
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };
      });
    
    if (materialsToInsert.length === 0) {
      console.log('⚠️  All materials already exist in the library');
      console.log(`   Found ${existingMaterials.length} existing materials`);
      return;
    }
    
    console.log(`📝 Inserting ${materialsToInsert.length} materials...`);
    const result = await db.collection('material_library').insertMany(materialsToInsert);
    
    console.log(`✅ Successfully inserted ${result.insertedCount} materials`);
    
    // Summary
    const commonCount = materialsToInsert.filter(m => m.isCommon).length;
    console.log(`\n📊 Seed Summary:`);
    console.log(`   • Total materials added: ${result.insertedCount}`);
    console.log(`   • Common materials: ${commonCount}`);
    console.log(`   • Regular materials: ${result.insertedCount - commonCount}`);
    console.log(`   • Categories used: ${new Set(materialsToInsert.map(m => m.category)).size}`);
    
    console.log('\n✅ Seed complete!');
    
  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

seedMaterialLibrary()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


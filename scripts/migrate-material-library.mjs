#!/usr/bin/env node

/**
 * Migration Script: Populate Material Library from Existing Materials
 * Extracts common materials from historical material requests and materials
 * 
 * Run with: node scripts/migrate-material-library.mjs
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

async function migrateMaterialLibrary() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB);
    
    console.log('🔄 Starting material library migration...\n');
    
    // Get all unique materials from material_requests
    console.log('📋 Analyzing material_requests...');
    const materialRequests = await db.collection('material_requests')
      .find({ deletedAt: null })
      .toArray();
    
    console.log(`   Found ${materialRequests.length} material requests`);
    
    // Get all unique materials from materials collection
    console.log('📋 Analyzing materials collection...');
    const materials = await db.collection('materials')
      .find({ deletedAt: null })
      .toArray();
    
    console.log(`   Found ${materials.length} materials`);
    
    // Aggregate material names with usage counts
    const materialMap = new Map();
    
    // Process material requests
    console.log('\n📊 Processing material requests...');
    materialRequests.forEach(req => {
      const name = req.materialName?.trim();
      if (!name || name.length < 2) return;
      
      const key = name.toLowerCase();
      if (!materialMap.has(key)) {
        materialMap.set(key, {
          name,
          unit: req.unit || 'piece',
          category: req.category || 'other',
          categoryId: req.categoryId,
          usageCount: 0,
          estimatedUnitCost: req.estimatedUnitCost || 0
        });
      }
      materialMap.get(key).usageCount++;
    });
    
    // Process materials
    console.log('📊 Processing materials...');
    materials.forEach(mat => {
      const name = (mat.name || mat.materialName)?.trim();
      if (!name || name.length < 2) return;
      
      const key = name.toLowerCase();
      if (!materialMap.has(key)) {
        materialMap.set(key, {
          name,
          unit: mat.unit || 'piece',
          category: mat.category || 'other',
          categoryId: mat.categoryId,
          usageCount: 0,
          estimatedUnitCost: mat.unitCost || 0
        });
      }
      materialMap.get(key).usageCount++;
    });
    
    console.log(`   Found ${materialMap.size} unique materials`);
    
    // Get categories map
    console.log('\n📋 Fetching categories...');
    const categories = await db.collection('categories').find({}).toArray();
    const categoryMap = new Map();
    categories.forEach(cat => {
      categoryMap.set(cat.name?.toLowerCase(), cat._id);
      if (cat._id) {
        categoryMap.set(cat._id.toString(), cat._id);
      }
    });
    
    // Check existing library materials to avoid duplicates
    console.log('📋 Checking existing library materials...');
    const existingLibrary = await db.collection('material_library')
      .find({ deletedAt: null })
      .toArray();
    const existingNames = new Set(
      existingLibrary.map(m => m.name?.toLowerCase())
    );
    
    // Insert into material library (only materials used 3+ times)
    console.log('\n📝 Creating library entries...');
    const libraryMaterials = Array.from(materialMap.values())
      .filter(m => {
        // Skip if already exists
        if (existingNames.has(m.name.toLowerCase())) {
          return false;
        }
        // Only include materials used 3+ times
        return m.usageCount >= 3;
      })
      .map(m => {
        // Try to find category ID
        let categoryId = m.categoryId;
        if (!categoryId && m.category) {
          categoryId = categoryMap.get(m.category.toLowerCase());
        }
        
        // Calculate average unit cost if available
        const avgCost = m.estimatedUnitCost > 0 ? m.estimatedUnitCost : null;
        
        return {
          name: m.name,
          description: '',
          categoryId: categoryId || null,
          category: m.category || 'other',
          defaultUnit: m.unit,
          defaultUnitCost: avgCost,
          materialCode: null,
          brand: null,
          specifications: null,
          usageCount: m.usageCount,
          lastUsedAt: null,
          lastUsedBy: null,
          isActive: true,
          isCommon: m.usageCount >= 10, // Mark as common if used 10+ times
          createdBy: null, // Will be set by OWNER later
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null
        };
      });
    
    if (libraryMaterials.length > 0) {
      console.log(`   Creating ${libraryMaterials.length} library entries...`);
      const result = await db.collection('material_library').insertMany(libraryMaterials);
      console.log(`✅ Inserted ${result.insertedCount} materials into library`);
      
      // Summary
      const commonCount = libraryMaterials.filter(m => m.isCommon).length;
      console.log(`\n📊 Migration Summary:`);
      console.log(`   • Total materials added: ${result.insertedCount}`);
      console.log(`   • Common materials (10+ uses): ${commonCount}`);
      console.log(`   • Regular materials (3-9 uses): ${result.insertedCount - commonCount}`);
    } else {
      console.log('⚠️  No new materials found with sufficient usage (3+ times)');
      console.log('   All materials may already be in the library or have insufficient usage');
    }
    
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

migrateMaterialLibrary()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


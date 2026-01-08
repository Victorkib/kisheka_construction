/**
 * Migration Script: Add Phase Associations to Materials and Expenses
 * 
 * This script adds phaseId field to existing materials and expenses.
 * For existing records without phaseId, they will remain unassigned (null).
 * Users can manually assign phases through the UI.
 * 
 * Usage:
 *   node scripts/migrate-phase-associations.mjs [--dry-run]
 */

import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env.local');
let envVars = {};
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  });
} catch (err) {
  console.log('No .env.local file found, using environment variables');
}

const MONGODB_URI = process.env.MONGODB_URI || envVars.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || envVars.MONGODB_DB || 'kisheka_construction';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

async function migratePhaseAssociations() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(MONGODB_DB);
    
    // Statistics
    let materialsUpdated = 0;
    let expensesUpdated = 0;
    let materialsSkipped = 0;
    let expensesSkipped = 0;
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
    console.log(`   Database: ${MONGODB_DB}\n`);
    
    // 1. Materials Collection
    console.log('📦 Processing Materials Collection...');
    
    const materialsCollection = db.collection('materials');
    const materialsCount = await materialsCollection.countDocuments({});
    console.log(`   Total materials: ${materialsCount}`);
    
    // Check how many already have phaseId
    const materialsWithPhase = await materialsCollection.countDocuments({
      phaseId: { $exists: true, $ne: null }
    });
    console.log(`   Materials with phaseId: ${materialsWithPhase}`);
    console.log(`   Materials without phaseId: ${materialsCount - materialsWithPhase}`);
    
    if (!isDryRun) {
      // Add phaseId field to materials that don't have it (set to null)
      const materialsResult = await materialsCollection.updateMany(
        { phaseId: { $exists: false } },
        { $set: { phaseId: null } }
      );
      materialsUpdated = materialsResult.modifiedCount;
      materialsSkipped = materialsCount - materialsUpdated;
      console.log(`   ✅ Updated ${materialsUpdated} materials (added phaseId: null)`);
    } else {
      const materialsToUpdate = await materialsCollection.countDocuments({
        phaseId: { $exists: false }
      });
      console.log(`   🔍 Would update ${materialsToUpdate} materials (would add phaseId: null)`);
    }
    
    // 2. Expenses Collection
    console.log('\n💰 Processing Expenses Collection...');
    
    const expensesCollection = db.collection('expenses');
    const expensesCount = await expensesCollection.countDocuments({});
    console.log(`   Total expenses: ${expensesCount}`);
    
    // Check how many already have phaseId
    const expensesWithPhase = await expensesCollection.countDocuments({
      phaseId: { $exists: true, $ne: null }
    });
    console.log(`   Expenses with phaseId: ${expensesWithPhase}`);
    console.log(`   Expenses without phaseId: ${expensesCount - expensesWithPhase}`);
    
    if (!isDryRun) {
      // Add phaseId field to expenses that don't have it (set to null)
      const expensesResult = await expensesCollection.updateMany(
        { phaseId: { $exists: false } },
        { $set: { phaseId: null } }
      );
      expensesUpdated = expensesResult.modifiedCount;
      expensesSkipped = expensesCount - expensesUpdated;
      console.log(`   ✅ Updated ${expensesUpdated} expenses (added phaseId: null)`);
    } else {
      const expensesToUpdate = await expensesCollection.countDocuments({
        phaseId: { $exists: false }
      });
      console.log(`   🔍 Would update ${expensesToUpdate} expenses (would add phaseId: null)`);
    }
    
    // 3. Create indexes for phaseId
    console.log('\n📇 Creating Indexes...');
    
    if (!isDryRun) {
      try {
        await materialsCollection.createIndex({ phaseId: 1 });
        console.log('   ✅ Created index on materials.phaseId');
      } catch (err) {
        if (err.code === 85) {
          console.log('   ℹ️  Index on materials.phaseId already exists');
        } else {
          console.log(`   ⚠️  Could not create index on materials.phaseId: ${err.message}`);
        }
      }
      
      try {
        await expensesCollection.createIndex({ phaseId: 1 });
        console.log('   ✅ Created index on expenses.phaseId');
      } catch (err) {
        if (err.code === 85) {
          console.log('   ℹ️  Index on expenses.phaseId already exists');
        } else {
          console.log(`   ⚠️  Could not create index on expenses.phaseId: ${err.message}`);
        }
      }
      
      // Create compound indexes for common queries
      try {
        await materialsCollection.createIndex({ projectId: 1, phaseId: 1 });
        console.log('   ✅ Created compound index on materials (projectId, phaseId)');
      } catch (err) {
        if (err.code === 85) {
          console.log('   ℹ️  Compound index on materials (projectId, phaseId) already exists');
        } else {
          console.log(`   ⚠️  Could not create compound index: ${err.message}`);
        }
      }
      
      try {
        await expensesCollection.createIndex({ projectId: 1, phaseId: 1 });
        console.log('   ✅ Created compound index on expenses (projectId, phaseId)');
      } catch (err) {
        if (err.code === 85) {
          console.log('   ℹ️  Compound index on expenses (projectId, phaseId) already exists');
        } else {
          console.log(`   ⚠️  Could not create compound index: ${err.message}`);
        }
      }
    } else {
      console.log('   🔍 Would create indexes on phaseId fields');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    if (!isDryRun) {
      console.log(`   ✅ Materials updated: ${materialsUpdated}`);
      console.log(`   ✅ Expenses updated: ${expensesUpdated}`);
      console.log(`   ⏭️  Materials skipped (already had phaseId): ${materialsSkipped}`);
      console.log(`   ⏭️  Expenses skipped (already had phaseId): ${expensesSkipped}`);
      console.log(`\n   ✅ Migration completed successfully!`);
      console.log(`\n   📝 Next Steps:`);
      console.log(`      1. Users can now assign phases to materials and expenses through the UI`);
      console.log(`      2. Phase financial summaries will automatically include phase-associated items`);
      console.log(`      3. Filtering by phase is now available in materials and expenses lists`);
    } else {
      console.log(`   🔍 This was a DRY RUN - no changes were made`);
      console.log(`   Run without --dry-run to apply changes`);
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ Database connection closed');
  }
}

// Run migration
migratePhaseAssociations()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });




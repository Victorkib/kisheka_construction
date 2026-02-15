/**
 * Migration Script: Initialize Floor Capital Allocation
 * 
 * Migrates existing floors to include capitalAllocation structure
 * This ensures all floors have the proper capital allocation structure initialized
 * 
 * Run with: node scripts/migrate-floor-capital-allocation.mjs [--dry-run] [--project-id=ID] [--floor-id=ID]
 * 
 * Options:
 *   --dry-run: Show what would be migrated without making changes
 *   --project-id=ID: Migrate only floors for specific project
 *   --floor-id=ID: Migrate only specific floor
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

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const projectIdArg = args.find(arg => arg.startsWith('--project-id='));
const floorIdArg = args.find(arg => arg.startsWith('--floor-id='));

const projectId = projectIdArg ? projectIdArg.split('=')[1] : null;
const floorId = floorIdArg ? floorIdArg.split('=')[1] : null;

/**
 * Initialize capital allocation structure
 * Matches the structure used in the codebase
 */
function initializeCapitalAllocation(floor) {
  return {
    total: floor.capitalAllocation?.total || 0,
    byPhase: floor.capitalAllocation?.byPhase || {},
    used: floor.capitalAllocation?.used || 0,
    committed: floor.capitalAllocation?.committed || 0,
    remaining: floor.capitalAllocation?.remaining || 0
  };
}

async function migrateFloorCapitalAllocation() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const floorsCollection = db.collection('floors');
    
    // Build query
    const query = { deletedAt: null };
    if (floorId) {
      if (!ObjectId.isValid(floorId)) {
        console.error(`❌ Invalid floor ID: ${floorId}`);
        process.exit(1);
      }
      query._id = new ObjectId(floorId);
    } else if (projectId) {
      if (!ObjectId.isValid(projectId)) {
        console.error(`❌ Invalid project ID: ${projectId}`);
        process.exit(1);
      }
      query.projectId = new ObjectId(projectId);
    }
    
    // Find floors that need migration
    // Floors that don't have capitalAllocation or have incomplete structure
    const floors = await floorsCollection.find(query).toArray();
    
    console.log(`📊 Found ${floors.length} floor(s) to check\n`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    const migrationResults = [];
    
    for (const floor of floors) {
      try {
        // Check if capitalAllocation exists and is complete
        const hasCapitalAllocation = floor.capitalAllocation && 
          typeof floor.capitalAllocation === 'object' &&
          'total' in floor.capitalAllocation &&
          'byPhase' in floor.capitalAllocation &&
          'used' in floor.capitalAllocation &&
          'committed' in floor.capitalAllocation &&
          'remaining' in floor.capitalAllocation;
        
        // Skip if already has complete structure
        if (hasCapitalAllocation) {
          skipped++;
          continue;
        }
        
        // Initialize capital allocation
        const newCapitalAllocation = initializeCapitalAllocation(floor);
        
        migrationResults.push({
          floorId: floor._id.toString(),
          floorNumber: floor.floorNumber,
          floorName: floor.name || `Floor ${floor.floorNumber}`,
          projectId: floor.projectId?.toString(),
          oldCapital: floor.capitalAllocation || null,
          newCapital: newCapitalAllocation
        });
        
        if (!isDryRun) {
          // Update floor
          await floorsCollection.updateOne(
            { _id: floor._id },
            {
              $set: {
                capitalAllocation: newCapitalAllocation,
                updatedAt: new Date()
              }
            }
          );
        }
        
        migrated++;
      } catch (error) {
        console.error(`❌ Error migrating floor ${floor._id}:`, error.message);
        errors++;
      }
    }
    
    // Print results
    console.log('\n📈 Migration Results:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped} (already have capitalAllocation)`);
    console.log(`   ❌ Errors: ${errors}`);
    
    if (isDryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were made');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Migration completed successfully');
    }
    
    // Print detailed results
    if (migrationResults.length > 0) {
      console.log('\n📋 Detailed Migration Results:');
      migrationResults.forEach(result => {
        console.log(`\n   Floor: ${result.floorName} (${result.floorNumber})`);
        console.log(`   Floor ID: ${result.floorId}`);
        console.log(`   Project ID: ${result.projectId}`);
        console.log(`   Old Capital: ${result.oldCapital ? JSON.stringify(result.oldCapital) : 'Missing'}`);
        console.log(`   New Capital: ${JSON.stringify(result.newCapital)}`);
      });
    }
    
    // Get project summary if projectId specified
    if (projectId) {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(projectId)
      });
      
      if (project) {
        console.log(`\n📁 Project: ${project.projectName || project.projectCode}`);
        console.log(`   Total floors in project: ${floors.length}`);
        console.log(`   Floors migrated: ${migrated}`);
        console.log(`   Floors skipped: ${skipped}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
console.log('🚀 Starting Floor Capital Allocation Migration...\n');

if (isDryRun) {
  console.log('⚠️  DRY RUN MODE - No changes will be made\n');
}

migrateFloorCapitalAllocation()
  .then(() => {
    console.log('\n✨ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

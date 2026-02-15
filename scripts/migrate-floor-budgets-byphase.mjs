/**
 * Migration Script: Floor Budget byPhase Structure
 * 
 * Migrates existing floors from legacy budget structure to byPhase structure
 * Maintains backward compatibility by keeping legacy fields
 * 
 * Run with: node scripts/migrate-floor-budgets-byphase.mjs [--dry-run] [--project-id=ID] [--floor-id=ID]
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
 * Initialize floor budget allocation structure with byPhase
 * This matches the logic in floor-financial-helpers.js
 */
function initializeFloorBudgetAllocation(floor) {
  const existingBudget = floor.budgetAllocation || { total: floor.totalBudget || 0 };
  
  // Initialize byPhase structure
  const byPhase = {
    'PHASE-01': {
      total: 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
      contingency: 0
    },
    'PHASE-02': {
      total: 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
      contingency: 0
    },
    'PHASE-03': {
      total: 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
      contingency: 0
    },
    'PHASE-04': {
      total: 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
      contingency: 0
    }
  };

  // If floor has existing budget but no byPhase, migrate it to PHASE-02 (legacy)
  if (existingBudget.total > 0 && !existingBudget.byPhase) {
    byPhase['PHASE-02'] = {
      total: existingBudget.total || 0,
      materials: existingBudget.materials || Math.round(existingBudget.total * 0.65),
      labour: existingBudget.labour || Math.round(existingBudget.total * 0.25),
      equipment: existingBudget.equipment || Math.round(existingBudget.total * 0.05),
      subcontractors: existingBudget.subcontractors || Math.round(existingBudget.total * 0.03),
      contingency: existingBudget.contingency || 0
    };
  } else if (existingBudget.byPhase) {
    // Merge existing byPhase structure
    Object.keys(byPhase).forEach(phaseCode => {
      if (existingBudget.byPhase[phaseCode]) {
        byPhase[phaseCode] = { ...existingBudget.byPhase[phaseCode] };
      }
    });
  }

  // Calculate total from byPhase
  const total = Object.values(byPhase).reduce((sum, phase) => sum + (phase.total || 0), 0);
  const materials = Object.values(byPhase).reduce((sum, phase) => sum + (phase.materials || 0), 0);
  const labour = Object.values(byPhase).reduce((sum, phase) => sum + (phase.labour || 0), 0);
  const equipment = Object.values(byPhase).reduce((sum, phase) => sum + (phase.equipment || 0), 0);
  const subcontractors = Object.values(byPhase).reduce((sum, phase) => sum + (phase.subcontractors || 0), 0);
  const contingency = Object.values(byPhase).reduce((sum, phase) => sum + (phase.contingency || 0), 0);

  return {
    total,
    byPhase,
    materials,
    labour,
    equipment,
    subcontractors,
    contingency
  };
}

async function migrateFloorBudgets() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
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
    // Floors that have budget but no byPhase structure, or byPhase is empty
    const floors = await floorsCollection.find(query).toArray();
    
    console.log(`\n📊 Found ${floors.length} floor(s) to check`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const migrationResults = [];
    
    for (const floor of floors) {
      try {
        const existingBudget = floor.budgetAllocation || { total: floor.totalBudget || 0 };
        const hasByPhase = existingBudget.byPhase && Object.keys(existingBudget.byPhase).length > 0;
        const hasBudget = existingBudget.total > 0 || floor.totalBudget > 0;
        
        // Skip if already has byPhase structure or no budget
        if (hasByPhase || !hasBudget) {
          skipped++;
          continue;
        }
        
        // Initialize new budget allocation
        const newBudgetAllocation = initializeFloorBudgetAllocation(floor);
        
        migrationResults.push({
          floorId: floor._id.toString(),
          floorNumber: floor.floorNumber,
          floorName: floor.name || `Floor ${floor.floorNumber}`,
          oldBudget: existingBudget.total || 0,
          newBudget: newBudgetAllocation.total,
          byPhase: newBudgetAllocation.byPhase
        });
        
        if (!isDryRun) {
          // Update floor
          await floorsCollection.updateOne(
            { _id: floor._id },
            {
              $set: {
                budgetAllocation: newBudgetAllocation,
                totalBudget: newBudgetAllocation.total, // Maintain legacy field
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
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    
    if (isDryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were made');
    } else {
      console.log('\n✅ Migration completed successfully');
    }
    
    // Print detailed results
    if (migrationResults.length > 0) {
      console.log('\n📋 Detailed Migration Results:');
      migrationResults.forEach(result => {
        console.log(`\n   Floor: ${result.floorName} (${result.floorNumber})`);
        console.log(`   Old Budget: ${result.oldBudget.toLocaleString()} KES`);
        console.log(`   New Budget: ${result.newBudget.toLocaleString()} KES`);
        console.log(`   Allocated to PHASE-02: ${result.byPhase['PHASE-02'].total.toLocaleString()} KES`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run migration
console.log('🚀 Starting Floor Budget byPhase Migration...');
if (isDryRun) {
  console.log('⚠️  DRY RUN MODE - No changes will be made');
}
if (projectId) {
  console.log(`📌 Project ID filter: ${projectId}`);
}
if (floorId) {
  console.log(`📌 Floor ID filter: ${floorId}`);
}
console.log('');

migrateFloorBudgets()
  .then(() => {
    console.log('\n✨ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

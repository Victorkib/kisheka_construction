/**
 * Migration Script: Enhanced Budget Structure
 * 
 * Migrates existing projects from legacy budget structure to enhanced hierarchical structure
 * Maintains backward compatibility by keeping legacy fields
 * 
 * Run with: node scripts/migrate-enhanced-budget.mjs [--dry-run] [--project-id=ID]
 * 
 * Options:
 *   --dry-run: Show what would be migrated without making changes
 *   --project-id=ID: Migrate only specific project
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

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const projectIdArg = args.find(arg => arg.startsWith('--project-id='));
const specificProjectId = projectIdArg ? projectIdArg.split('=')[1] : null;

/**
 * Check if budget is already in enhanced format
 */
function isEnhancedBudget(budget) {
  if (!budget || typeof budget !== 'object') {
    return false;
  }
  return budget.directCosts !== undefined;
}

/**
 * Convert legacy budget to enhanced structure
 */
function convertLegacyToEnhanced(legacyBudget) {
  if (!legacyBudget) {
    return null;
  }
  
  const materials = legacyBudget.materials || 0;
  const labour = legacyBudget.labour || 0;
  const contingency = legacyBudget.contingency || 0;
  const total = legacyBudget.total || 0;
  const spent = legacyBudget.spent || 0;
  
  // Calculate DCC (materials + labour + estimated equipment/subcontractors)
  // For migration, we'll estimate equipment and subcontractors as percentages
  const estimatedEquipment = (materials + labour) * 0.1;
  const estimatedSubcontractors = (materials + labour) * 0.05;
  const directConstructionCosts = materials + labour + estimatedEquipment + estimatedSubcontractors;
  
  // Estimate pre-construction as 5% of total if not specified
  const preConstructionCosts = total * 0.05;
  
  // Estimate indirect costs as 3% of total if not specified
  const indirectCosts = total * 0.03;
  
  // Calculate remaining for DCC
  const remainingForDCC = total - preConstructionCosts - indirectCosts - contingency;
  const adjustedDCC = Math.max(0, remainingForDCC);
  
  return {
    // Top-level totals
    total,
    directConstructionCosts: adjustedDCC,
    preConstructionCosts,
    indirectCosts,
    contingencyReserve: contingency,
    
    // Direct Construction Costs breakdown
    directCosts: {
      materials: {
        total: materials,
        structural: materials * 0.65,      // Estimate 65% structural
        finishing: materials * 0.25,       // Estimate 25% finishing
        mep: materials * 0.08,             // Estimate 8% MEP
        specialty: materials * 0.02        // Estimate 2% specialty
      },
      labour: {
        total: labour,
        skilled: labour * 0.6,             // Estimate 60% skilled
        unskilled: labour * 0.3,            // Estimate 30% unskilled
        supervisory: labour * 0.08,         // Estimate 8% supervisory
        specialized: labour * 0.02          // Estimate 2% specialized
      },
      equipment: {
        total: estimatedEquipment,
        rental: estimatedEquipment * 0.7,
        purchase: estimatedEquipment * 0.2,
        maintenance: estimatedEquipment * 0.1
      },
      subcontractors: {
        total: estimatedSubcontractors,
        specializedTrades: estimatedSubcontractors * 0.8,
        professionalServices: estimatedSubcontractors * 0.2
      }
    },
    
    // Pre-Construction Costs breakdown
    preConstruction: {
      total: preConstructionCosts,
      landAcquisition: preConstructionCosts * 0.5,
      legalRegulatory: preConstructionCosts * 0.2,
      permitsApprovals: preConstructionCosts * 0.2,
      sitePreparation: preConstructionCosts * 0.1
    },
    
    // Indirect Costs breakdown
    indirect: {
      total: indirectCosts,
      siteOverhead: indirectCosts * 0.4,
      transportation: indirectCosts * 0.3,
      utilities: indirectCosts * 0.2,
      safetyCompliance: indirectCosts * 0.1
    },
    
    // Contingency breakdown
    contingency: {
      total: contingency,
      designContingency: contingency * 0.2,
      constructionContingency: contingency * 0.7,
      ownersReserve: contingency * 0.1
    },
    
    // Phase allocations (estimated based on typical construction)
    phaseAllocations: {
      preConstruction: preConstructionCosts,
      basement: adjustedDCC * 0.15,
      superstructure: adjustedDCC * 0.65,
      finishing: adjustedDCC * 0.15,
      finalSystems: adjustedDCC * 0.05
    },
    
    // Financial states (initialize)
    financialStates: {
      budgeted: total,
      estimated: 0,
      committed: 0,
      actual: spent,
      forecast: total
    },
    
    // Legacy fields (for backward compatibility)
    materials,
    labour,
    contingency,
    spent
  };
}

async function migrateProjects() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }
    
    // Find projects to migrate
    const query = { deletedAt: null };
    if (specificProjectId) {
      query._id = require('mongodb').ObjectId.createFromHexString(specificProjectId);
      console.log(`🎯 Migrating specific project: ${specificProjectId}\n`);
    }
    
    const projectsCollection = db.collection('projects');
    const projects = await projectsCollection.find(query).toArray();
    
    console.log(`📊 Found ${projects.length} project(s) to check\n`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const project of projects) {
      try {
        const projectId = project._id.toString();
        const projectName = project.projectName || 'Unnamed Project';
        
        // Check if already enhanced
        if (isEnhancedBudget(project.budget)) {
          console.log(`⏭️  Skipping ${projectName} (${projectId}) - already using enhanced structure`);
          skippedCount++;
          continue;
        }
        
        // Check if has budget
        if (!project.budget || !project.budget.total) {
          console.log(`⏭️  Skipping ${projectName} (${projectId}) - no budget defined`);
          skippedCount++;
          continue;
        }
        
        console.log(`🔄 Migrating ${projectName} (${projectId})...`);
        console.log(`   Current budget: ${project.budget.total?.toLocaleString()} KES`);
        console.log(`   Materials: ${project.budget.materials?.toLocaleString()} KES`);
        console.log(`   Labour: ${project.budget.labour?.toLocaleString()} KES`);
        console.log(`   Contingency: ${project.budget.contingency?.toLocaleString()} KES`);
        
        // Convert budget
        const enhancedBudget = convertLegacyToEnhanced(project.budget);
        
        console.log(`   Enhanced DCC: ${enhancedBudget.directConstructionCosts.toLocaleString()} KES`);
        console.log(`   Pre-Construction: ${enhancedBudget.preConstructionCosts.toLocaleString()} KES`);
        console.log(`   Indirect: ${enhancedBudget.indirectCosts.toLocaleString()} KES`);
        
        if (!isDryRun) {
          // Update project with enhanced budget
          await projectsCollection.updateOne(
            { _id: project._id },
            {
              $set: {
                budget: enhancedBudget,
                updatedAt: new Date(),
                'metadata.budgetMigrated': true,
                'metadata.budgetMigratedAt': new Date()
              }
            }
          );
          
          console.log(`   ✅ Migrated successfully\n`);
        } else {
          console.log(`   ✅ Would migrate (dry run)\n`);
        }
        
        migratedCount++;
        
      } catch (error) {
        console.error(`   ❌ Error migrating project ${project._id}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📦 Total: ${projects.length}`);
    
    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run migration
migrateProjects().catch(console.error);




/**
 * Dual Workflow Migration Script
 * Migrates existing data to support dual workflow system
 * 
 * Run with: node scripts/migrate-dual-workflow.mjs
 * 
 * WARNING: This script modifies existing data. Make sure to backup your database first!
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

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

// Backup directory
const BACKUP_DIR = join(__dirname, '..', 'backups');

async function createBackup(db, backupDir, timestamp) {
  console.log('💾 Creating database backup...');
  
  // Ensure backup directory exists
  if (!existsSync(backupDir)) {
    await mkdir(backupDir, { recursive: true });
  }
  
  const collectionsToBackup = ['materials', 'project_finances'];
  const backupData = {
    timestamp,
    database: DB_NAME,
    collections: {}
  };
  
  for (const collectionName of collectionsToBackup) {
    console.log(`   Backing up ${collectionName}...`);
    const collection = db.collection(collectionName);
    const documents = await collection.find({}).toArray();
    backupData.collections[collectionName] = documents;
    console.log(`   ✅ Backed up ${documents.length} documents from ${collectionName}`);
  }
  
  const backupFileName = `backup-${timestamp}.json`;
  const backupPath = join(backupDir, backupFileName);
  
  await writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`   ✅ Backup saved to: ${backupPath}\n`);
  
  return backupPath;
}

async function migrateDualWorkflow() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    
    // ============================================
    // STEP 0: Create Backup
    // ============================================
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = await createBackup(db, BACKUP_DIR, timestamp);
    console.log(`📝 Backup location: ${backupPath}\n`);
    
    // ============================================
    // STEP 1: Update Existing Materials
    // ============================================
    console.log('📋 Step 1: Updating existing materials...');
    const materialsCollection = db.collection('materials');
    
    // Count materials that need migration
    const materialsToMigrate = await materialsCollection.countDocuments({
      $or: [
        { entryType: { $exists: false } },
        { materialRequestId: { $exists: false } },
        { purchaseOrderId: { $exists: false } }
      ]
    });
    
    console.log(`   Found ${materialsToMigrate} materials to migrate`);
    
    if (materialsToMigrate > 0) {
      // Update all materials that don't have entryType set
      const updateResult = await materialsCollection.updateMany(
        {
          $or: [
            { entryType: { $exists: false } },
            { materialRequestId: { $exists: false } },
            { purchaseOrderId: { $exists: false } }
          ]
        },
        [
          {
            $set: {
              entryType: 'retroactive_entry',
              isRetroactiveEntry: true,
              materialRequestId: null,
              purchaseOrderId: null,
              orderFulfillmentDate: null,
              costStatus: {
                $cond: [
                  { $gt: [{ $ifNull: ['$totalCost', 0] }, 0] },
                  'actual',
                  'missing'
                ]
              },
              costVerified: false,
              documentationStatus: {
                $cond: [
                  { $ifNull: ['$receiptFileUrl', false] },
                  'complete',
                  {
                    $cond: [
                      { $ifNull: ['$invoiceFileUrl', false] },
                      'partial',
                      'missing'
                    ]
                  }
                ]
              }
            }
          }
        ]
      );
      
      console.log(`   ✅ Updated ${updateResult.modifiedCount} materials`);
      console.log(`   ✅ Matched ${updateResult.matchedCount} materials\n`);
    } else {
      console.log('   ℹ️  No materials need migration\n');
    }
    
    // Verify migration
    const materialsWithoutEntryType = await materialsCollection.countDocuments({
      entryType: { $exists: false }
    });
    
    if (materialsWithoutEntryType > 0) {
      console.warn(`   ⚠️  Warning: ${materialsWithoutEntryType} materials still missing entryType`);
    } else {
      console.log('   ✅ All materials have entryType set\n');
    }
    
    // ============================================
    // STEP 2: Update project_finances
    // ============================================
    console.log('📋 Step 2: Updating project_finances collection...');
    const projectFinancesCollection = db.collection('project_finances');
    
    // Count project_finances that need migration
    const financesToMigrate = await projectFinancesCollection.countDocuments({
      $or: [
        { committedCost: { $exists: false } },
        { estimatedCost: { $exists: false } },
        { availableCapital: { $exists: false } },
        { materialsBreakdown: { $exists: false } }
      ]
    });
    
    console.log(`   Found ${financesToMigrate} project_finances records to migrate`);
    
    if (financesToMigrate > 0) {
      // Get all project_finances that need updating
      const finances = await projectFinancesCollection.find({
        $or: [
          { committedCost: { $exists: false } },
          { estimatedCost: { $exists: false } },
          { availableCapital: { $exists: false } },
          { materialsBreakdown: { $exists: false } }
        ]
      }).toArray();
      
      let updatedCount = 0;
      
      for (const finance of finances) {
        const totalInvested = finance.totalInvested || 0;
        const totalUsed = finance.totalUsed || 0;
        const committedCost = finance.committedCost || 0;
        const estimatedCost = finance.estimatedCost || 0;
        const availableCapital = totalInvested - totalUsed - committedCost;
        
        // Get project to find materials budget
        const project = await db.collection('projects').findOne({
          _id: finance.projectId
        });
        
        const materialsBudget = project?.budget?.materials || 0;
        
        // Calculate materials breakdown
        const materialsActual = await db.collection('materials').aggregate([
          {
            $match: {
              projectId: finance.projectId,
              status: { $in: ['approved', 'received', 'in_use'] },
              deletedAt: null,
              costStatus: { $in: ['actual', 'estimated'] }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $ifNull: ['$totalCost', 0] } }
            }
          }
        ]).toArray();
        
        const materialsActualTotal = materialsActual[0]?.total || 0;
        
        const materialsBreakdown = {
          budget: materialsBudget,
          actual: materialsActualTotal,
          committed: 0, // Will be calculated when purchase orders exist
          estimated: 0, // Will be calculated when material requests exist
          remaining: Math.max(0, materialsBudget - materialsActualTotal),
          variance: materialsActualTotal - materialsBudget
        };
        
        // Update the record
        await projectFinancesCollection.updateOne(
          { _id: finance._id },
          {
            $set: {
              committedCost: committedCost,
              estimatedCost: estimatedCost,
              availableCapital: availableCapital,
              materialsBreakdown: materialsBreakdown,
              updatedAt: new Date()
            }
          }
        );
        
        updatedCount++;
      }
      
      console.log(`   ✅ Updated ${updatedCount} project_finances records\n`);
    } else {
      console.log('   ℹ️  No project_finances need migration\n');
    }
    
    // Verify migration
    const financesWithoutFields = await projectFinancesCollection.countDocuments({
      $or: [
        { committedCost: { $exists: false } },
        { estimatedCost: { $exists: false } },
        { availableCapital: { $exists: false } },
        { materialsBreakdown: { $exists: false } }
      ]
    });
    
    if (financesWithoutFields > 0) {
      console.warn(`   ⚠️  Warning: ${financesWithoutFields} project_finances still missing new fields`);
    } else {
      console.log('   ✅ All project_finances have new fields set\n');
    }
    
    // ============================================
    // STEP 3: Verification Summary
    // ============================================
    console.log('📋 Step 3: Verification Summary...');
    
    const totalMaterials = await materialsCollection.countDocuments({});
    const materialsWithEntryType = await materialsCollection.countDocuments({
      entryType: { $exists: true }
    });
    
    const totalFinances = await projectFinancesCollection.countDocuments({});
    const financesWithAllFields = await projectFinancesCollection.countDocuments({
      committedCost: { $exists: true },
      estimatedCost: { $exists: true },
      availableCapital: { $exists: true },
      materialsBreakdown: { $exists: true }
    });
    
    console.log(`   Materials: ${materialsWithEntryType}/${totalMaterials} have entryType`);
    console.log(`   Project Finances: ${financesWithAllFields}/${totalFinances} have all new fields`);
    
    if (materialsWithEntryType === totalMaterials && financesWithAllFields === totalFinances) {
      console.log('\n   ✅ Migration completed successfully!\n');
    } else {
      console.warn('\n   ⚠️  Migration completed with warnings. Please review above.\n');
    }
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log('📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Materials migrated: ${materialsWithEntryType}/${totalMaterials}`);
    console.log(`✅ Project finances migrated: ${financesWithAllFields}/${totalFinances}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 Migration script completed!');
    
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

// Run the migration
migrateDualWorkflow()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });


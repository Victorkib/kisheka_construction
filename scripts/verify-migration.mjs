/**
 * Migration Verification Script
 * Verifies that the dual workflow migration was successful
 * 
 * Run with: node scripts/verify-migration.mjs
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

async function verifyMigration() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    
    let allChecksPassed = true;
    
    // ============================================
    // Check 1: Materials have entryType
    // ============================================
    console.log('📋 Check 1: Verifying materials have entryType...');
    const materialsCollection = db.collection('materials');
    
    const totalMaterials = await materialsCollection.countDocuments({});
    const materialsWithEntryType = await materialsCollection.countDocuments({
      entryType: { $exists: true }
    });
    
    console.log(`   Total materials: ${totalMaterials}`);
    console.log(`   Materials with entryType: ${materialsWithEntryType}`);
    
    if (materialsWithEntryType === totalMaterials) {
      console.log('   ✅ All materials have entryType\n');
    } else {
      console.warn(`   ⚠️  ${totalMaterials - materialsWithEntryType} materials missing entryType\n`);
      allChecksPassed = false;
    }
    
    // Check entryType distribution
    const entryTypeDistribution = await materialsCollection.aggregate([
      {
        $group: {
          _id: '$entryType',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    console.log('   Entry type distribution:');
    entryTypeDistribution.forEach(({ _id, count }) => {
      console.log(`     - ${_id || 'null'}: ${count}`);
    });
    console.log('');
    
    // ============================================
    // Check 2: Materials have dual workflow fields
    // ============================================
    console.log('📋 Check 2: Verifying materials have dual workflow fields...');
    
    const materialsWithAllFields = await materialsCollection.countDocuments({
      entryType: { $exists: true },
      isRetroactiveEntry: { $exists: true },
      costStatus: { $exists: true },
      documentationStatus: { $exists: true }
    });
    
    console.log(`   Materials with all fields: ${materialsWithAllFields}/${totalMaterials}`);
    
    if (materialsWithAllFields === totalMaterials) {
      console.log('   ✅ All materials have required dual workflow fields\n');
    } else {
      console.warn(`   ⚠️  ${totalMaterials - materialsWithAllFields} materials missing some fields\n`);
      allChecksPassed = false;
    }
    
    // ============================================
    // Check 3: project_finances have new fields
    // ============================================
    console.log('📋 Check 3: Verifying project_finances have new fields...');
    const projectFinancesCollection = db.collection('project_finances');
    
    const totalFinances = await projectFinancesCollection.countDocuments({});
    const financesWithAllFields = await projectFinancesCollection.countDocuments({
      committedCost: { $exists: true },
      estimatedCost: { $exists: true },
      availableCapital: { $exists: true },
      materialsBreakdown: { $exists: true }
    });
    
    console.log(`   Total project_finances: ${totalFinances}`);
    console.log(`   Project finances with all fields: ${financesWithAllFields}`);
    
    if (financesWithAllFields === totalFinances) {
      console.log('   ✅ All project_finances have new fields\n');
    } else {
      console.warn(`   ⚠️  ${totalFinances - financesWithAllFields} project_finances missing new fields\n`);
      allChecksPassed = false;
    }
    
    // ============================================
    // Check 4: Verify financial calculations
    // ============================================
    console.log('📋 Check 4: Verifying financial calculations...');
    
    const finances = await projectFinancesCollection.find({}).toArray();
    let calculationErrors = 0;
    
    for (const finance of finances) {
      const totalInvested = finance.totalInvested || 0;
      const totalUsed = finance.totalUsed || 0;
      const committedCost = finance.committedCost || 0;
      const expectedAvailableCapital = totalInvested - totalUsed - committedCost;
      const actualAvailableCapital = finance.availableCapital || 0;
      
      // Allow small floating point differences
      if (Math.abs(expectedAvailableCapital - actualAvailableCapital) > 0.01) {
        console.warn(`   ⚠️  Project ${finance.projectId}: Available capital mismatch. Expected: ${expectedAvailableCapital}, Actual: ${actualAvailableCapital}`);
        calculationErrors++;
      }
      
      // Verify materialsBreakdown structure
      if (finance.materialsBreakdown) {
        const breakdown = finance.materialsBreakdown;
        if (typeof breakdown.budget !== 'number' ||
            typeof breakdown.actual !== 'number' ||
            typeof breakdown.committed !== 'number' ||
            typeof breakdown.estimated !== 'number') {
          console.warn(`   ⚠️  Project ${finance.projectId}: materialsBreakdown has invalid structure`);
          calculationErrors++;
        }
      }
    }
    
    if (calculationErrors === 0) {
      console.log('   ✅ All financial calculations are correct\n');
    } else {
      console.warn(`   ⚠️  Found ${calculationErrors} calculation errors\n`);
      allChecksPassed = false;
    }
    
    // ============================================
    // Check 5: Verify new collections exist
    // ============================================
    console.log('📋 Check 5: Verifying new collections exist...');
    
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    const requiredCollections = ['material_requests', 'purchase_orders'];
    const missingCollections = requiredCollections.filter(name => !collectionNames.includes(name));
    
    if (missingCollections.length === 0) {
      console.log('   ✅ All required collections exist\n');
    } else {
      console.warn(`   ⚠️  Missing collections: ${missingCollections.join(', ')}\n`);
      allChecksPassed = false;
    }
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log('📊 Verification Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Materials with entryType: ${materialsWithEntryType}/${totalMaterials}`);
    console.log(`✅ Materials with all fields: ${materialsWithAllFields}/${totalMaterials}`);
    console.log(`✅ Project finances with all fields: ${financesWithAllFields}/${totalFinances}`);
    console.log(`✅ Financial calculation errors: ${calculationErrors}`);
    console.log(`✅ Missing collections: ${missingCollections.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (allChecksPassed) {
      console.log('🎉 All verification checks passed! Migration is successful.\n');
    } else {
      console.warn('⚠️  Some verification checks failed. Please review the warnings above.\n');
    }
    
    return allChecksPassed;
    
  } catch (error) {
    console.error('❌ Verification error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the verification
verifyMigration()
  .then((success) => {
    if (success) {
      console.log('✅ Verification completed successfully');
      process.exit(0);
    } else {
      console.log('⚠️  Verification completed with warnings');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });


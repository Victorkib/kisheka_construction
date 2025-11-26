/**
 * Migration Script: Recalculate Project Finances
 * 
 * This script recalculates all cached project_finances records with the correct
 * expense status filter (APPROVED, PAID instead of 'approved').
 * 
 * This fixes stale data caused by the bug where expenses were excluded from
 * financial calculations.
 * 
 * Run with: node scripts/recalculate-project-finances.mjs
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
const MONGODB_DB = process.env.MONGODB_DB || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

/**
 * Calculate total used for a project (with correct expense status filter)
 */
async function calculateTotalUsed(db, projectId) {
  // Get total from expenses (APPROVED or PAID - uppercase)
  const expensesTotal = await db
    .collection('expenses')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: ['APPROVED', 'PAID'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ])
    .toArray();

  // Get total from materials (approved or received - lowercase)
  const materialsTotal = await db
    .collection('materials')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: ['approved', 'received'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCost' },
        },
      },
    ])
    .toArray();

  // Get total from initial expenses (approved - lowercase)
  const initialExpensesTotal = await db
    .collection('initial_expenses')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: ['approved'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ])
    .toArray();

  const totalExpenses = expensesTotal[0]?.total || 0;
  const totalMaterials = materialsTotal[0]?.total || 0;
  const totalInitialExpenses = initialExpensesTotal[0]?.total || 0;

  return {
    totalExpenses,
    totalMaterials,
    totalInitialExpenses,
    totalUsed: totalExpenses + totalMaterials + totalInitialExpenses,
  };
}

/**
 * Calculate project totals from investor allocations
 */
async function calculateProjectTotals(db, projectId) {
  const investors = await db
    .collection('investors')
    .find({ status: 'ACTIVE' })
    .toArray();

  let totalInvested = 0;
  let totalLoans = 0;
  let totalEquity = 0;

  for (const investor of investors) {
    const allocations = investor.projectAllocations || [];
    const projectAllocation = allocations.find(
      (alloc) => alloc.projectId && alloc.projectId.toString() === projectId.toString()
    );

    if (projectAllocation && projectAllocation.amount) {
      const amount = projectAllocation.amount;
      totalInvested += amount;

      if (investor.investmentType === 'LOAN') {
        totalLoans += amount;
      } else if (investor.investmentType === 'EQUITY') {
        totalEquity += amount;
      } else if (investor.investmentType === 'MIXED') {
        totalLoans += amount * 0.5;
        totalEquity += amount * 0.5;
      }
    }
  }

  return { totalInvested, totalLoans, totalEquity };
}

async function recalculateProjectFinances() {
  let client;

  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(MONGODB_DB);
    const projectsCollection = db.collection('projects');
    const projectFinancesCollection = db.collection('project_finances');

    // Get all active projects
    console.log('📊 Fetching all projects...');
    const projects = await projectsCollection
      .find({ deletedAt: null })
      .toArray();
    console.log(`📦 Found ${projects.length} projects to recalculate`);

    if (projects.length === 0) {
      console.log('✅ No projects to recalculate');
      return;
    }

    let updated = 0;
    let created = 0;
    let errors = 0;
    const changes = [];

    for (const project of projects) {
      try {
        const projectId = project._id.toString();
        console.log(`\n🔄 Processing project: ${project.projectCode || projectId}`);

        // Calculate totals
        const spending = await calculateTotalUsed(db, projectId);
        const totals = await calculateProjectTotals(db, projectId);

        const capitalBalance = totals.totalInvested - spending.totalUsed;
        const loanBalance = totals.totalLoans - (spending.totalUsed * (totals.totalLoans / totals.totalInvested || 0));
        const equityBalance = totals.totalEquity - (spending.totalUsed * (totals.totalEquity / totals.totalInvested || 0));

        // Get investor count for this project
        const projectAllocations = await db
          .collection('investors')
          .aggregate([
            {
              $match: {
                status: 'ACTIVE',
                'projectAllocations.projectId': new ObjectId(projectId),
              },
            },
          ])
          .toArray();
        const investorCount = projectAllocations.length;

        // Check if record exists
        const existing = await projectFinancesCollection.findOne({
          projectId: new ObjectId(projectId),
        });

        const updateData = {
          totalInvested: totals.totalInvested,
          totalLoans: totals.totalLoans,
          totalEquity: totals.totalEquity,
          totalUsed: spending.totalUsed,
          capitalBalance,
          loanBalance,
          equityBalance,
          investorCount,
          lastUpdated: new Date(),
          updatedAt: new Date(),
        };

        if (existing) {
          // Compare old vs new values
          const oldTotalUsed = existing.totalUsed || 0;
          const newTotalUsed = spending.totalUsed;
          const difference = newTotalUsed - oldTotalUsed;

          if (difference !== 0) {
            changes.push({
              project: project.projectCode || projectId,
              oldTotalUsed,
              newTotalUsed,
              difference,
              expenses: spending.totalExpenses,
              materials: spending.totalMaterials,
              initialExpenses: spending.totalInitialExpenses,
            });
          }

          await projectFinancesCollection.updateOne(
            { projectId: new ObjectId(projectId) },
            { $set: updateData }
          );
          updated++;
          console.log(`  ✅ Updated: Total Used = ${spending.totalUsed.toLocaleString()} (was ${oldTotalUsed.toLocaleString()})`);
        } else {
          // Create new record
          await projectFinancesCollection.insertOne({
            projectId: new ObjectId(projectId),
            ...updateData,
            createdAt: new Date(),
          });
          created++;
          console.log(`  ✅ Created: Total Used = ${spending.totalUsed.toLocaleString()}`);
        }

        console.log(`  📊 Breakdown: Expenses=${spending.totalExpenses.toLocaleString()}, Materials=${spending.totalMaterials.toLocaleString()}, Initial=${spending.totalInitialExpenses.toLocaleString()}`);
      } catch (error) {
        errors++;
        console.error(`  ❌ Error processing project ${project._id}:`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Updated: ${updated} projects`);
    console.log(`🆕 Created: ${created} projects`);
    console.log(`❌ Errors: ${errors} projects`);
    console.log(`📈 Total processed: ${updated + created} projects`);

    if (changes.length > 0) {
      console.log('\n📋 Projects with Changes:');
      changes.forEach((change) => {
        console.log(`  • ${change.project}:`);
        console.log(`    Old Total Used: ${change.oldTotalUsed.toLocaleString()}`);
        console.log(`    New Total Used: ${change.newTotalUsed.toLocaleString()}`);
        console.log(`    Difference: ${change.difference > 0 ? '+' : ''}${change.difference.toLocaleString()}`);
        console.log(`    Breakdown: Expenses=${change.expenses.toLocaleString()}, Materials=${change.materials.toLocaleString()}, Initial=${change.initialExpenses.toLocaleString()}`);
      });
    } else {
      console.log('\n✅ No changes detected - all records were already correct');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run migration
recalculateProjectFinances().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});





/**
 * Backfill script: set indirectCostCategory = 'siteOverhead' for existing indirect labour entries and batches
 * Run with: node scripts/backfill_indirect_cost_category.js
 */

(async () => {
  try {
    const { getDatabase } = await import('../src/lib/mongodb/connection.js');
    const db = await getDatabase();

    // Backfill labour entries
    const entriesFilter = { isIndirectLabour: true, $or: [{ indirectCostCategory: { $exists: false } }, { indirectCostCategory: null }] };
    const entriesResult = await db.collection('labour_entries').updateMany(entriesFilter, { $set: { indirectCostCategory: 'siteOverhead' } });

    // Backfill labour batches
    const batchesFilter = { isIndirectLabour: true, $or: [{ indirectCostCategory: { $exists: false } }, { indirectCostCategory: null }] };
    const batchesResult = await db.collection('labour_batches').updateMany(batchesFilter, { $set: { indirectCostCategory: 'siteOverhead' } });

    console.log('Backfill complete');
    console.log('Entries modified:', entriesResult.modifiedCount || entriesResult.matchedCount);
    console.log('Batches modified:', batchesResult.modifiedCount || batchesResult.matchedCount);
    process.exit(0);
  } catch (err) {
    console.error('Backfill error:', err);
    process.exit(1);
  }
})();

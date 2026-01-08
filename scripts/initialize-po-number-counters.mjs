/**
 * Initialize Purchase Order Number Counters
 * 
 * This script initializes the purchase_order_number_counters collection
 * from existing purchase orders to ensure smooth migration to atomic counter pattern.
 * 
 * Run: node scripts/initialize-po-number-counters.mjs
 */

import { getDatabase } from '../src/lib/mongodb/connection.js';
import { getClient } from '../src/lib/mongodb/connection.js';

async function initializePOCounters() {
  try {
    console.log('🔄 Starting Purchase Order Number Counter Initialization...\n');

    const db = await getDatabase();
    const client = await getClient();

    // Get all purchase orders grouped by date
    const purchaseOrders = await db
      .collection('purchase_orders')
      .find({
        deletedAt: null,
        purchaseOrderNumber: { $exists: true, $ne: '' },
      })
      .sort({ purchaseOrderNumber: 1 })
      .toArray();

    console.log(`📊 Found ${purchaseOrders.length} purchase orders to process\n`);

    if (purchaseOrders.length === 0) {
      console.log('✅ No purchase orders found. Counters will be initialized on first use.');
      return;
    }

    // Group by date and find max sequence for each date
    const dateCounters = {};

    for (const po of purchaseOrders) {
      const poNumber = po.purchaseOrderNumber;
      if (!poNumber || !poNumber.startsWith('PO-')) {
        continue;
      }

      // Extract date from PO number: PO-YYYYMMDD-XXX
      const dateMatch = poNumber.match(/^PO-(\d{8})-/);
      if (!dateMatch) {
        continue;
      }

      const dateStr = dateMatch[1];
      const counterKey = `po_${dateStr}`;

      // Extract sequence number
      const seqMatch = poNumber.match(/-(\d{3})$/);
      if (!seqMatch) {
        continue;
      }

      const sequence = parseInt(seqMatch[1], 10);
      if (isNaN(sequence)) {
        continue;
      }

      // Track max sequence for each date
      if (!dateCounters[counterKey]) {
        dateCounters[counterKey] = {
          dateStr,
          maxSequence: sequence,
          count: 0,
        };
      }

      dateCounters[counterKey].maxSequence = Math.max(
        dateCounters[counterKey].maxSequence,
        sequence
      );
      dateCounters[counterKey].count++;
    }

    console.log(`📅 Found ${Object.keys(dateCounters).length} unique dates\n`);

    // Initialize counters collection
    const countersCollection = db.collection('purchase_order_number_counters');
    let initialized = 0;
    let skipped = 0;

    for (const [counterKey, data] of Object.entries(dateCounters)) {
      // Check if counter already exists
      const existing = await countersCollection.findOne({ _id: counterKey });

      if (existing) {
        // Update if existing counter is lower
        if (existing.sequence < data.maxSequence) {
          await countersCollection.updateOne(
            { _id: counterKey },
            { $set: { sequence: data.maxSequence + 1, updatedAt: new Date() } }
          );
          console.log(
            `✅ Updated counter ${counterKey}: sequence ${data.maxSequence + 1} (from ${data.count} POs)`
          );
          initialized++;
        } else {
          console.log(
            `⏭️  Skipped counter ${counterKey}: already at sequence ${existing.sequence} (max found: ${data.maxSequence})`
          );
          skipped++;
        }
      } else {
        // Create new counter
        await countersCollection.insertOne({
          _id: counterKey,
          sequence: data.maxSequence + 1,
          dateStr: data.dateStr,
          initializedFrom: data.count,
          initializedAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(
          `✅ Initialized counter ${counterKey}: sequence ${data.maxSequence + 1} (from ${data.count} POs)`
        );
        initialized++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Initialized/Updated: ${initialized}`);
    console.log(`   ⏭️  Skipped (already up-to-date): ${skipped}`);
    console.log(`   📅 Total dates processed: ${Object.keys(dateCounters).length}`);

    // Verify today's counter
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const todayKey = `po_${todayStr}`;
    const todayCounter = await countersCollection.findOne({ _id: todayKey });

    if (todayCounter) {
      console.log(`\n📅 Today's counter (${todayKey}): sequence ${todayCounter.sequence}`);
    } else {
      console.log(`\n📅 Today's counter (${todayKey}): will be created on first use`);
    }

    console.log('\n✅ Purchase Order Number Counter Initialization Complete!\n');
  } catch (error) {
    console.error('❌ Error initializing PO counters:', error);
    process.exit(1);
  } finally {
    const client = await getClient();
    await client.close();
    process.exit(0);
  }
}

// Run initialization
initializePOCounters();


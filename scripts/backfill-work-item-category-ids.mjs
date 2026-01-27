/**
 * Backfill categoryId for work items and labour entries based on category names/work items.
 *
 * Run with: node scripts/backfill-work-item-category-ids.mjs
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

const WORK_ITEM_CATEGORY_TYPE = 'work_items';

async function backfillCategoryIds() {
  let client;

  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    const categories = await db.collection('categories').find({
      type: WORK_ITEM_CATEGORY_TYPE,
    }).toArray();

    const categoryMap = new Map();
    categories.forEach((category) => {
      categoryMap.set(category.name.toLowerCase(), category._id);
    });

    console.log('🧩 Backfilling work item categoryIds...');
    const workItems = await db.collection('work_items').find({
      deletedAt: null,
      $or: [
        { categoryId: { $exists: false } },
        { categoryId: null },
      ],
      category: { $exists: true, $ne: null },
    }).toArray();

    let workItemUpdates = 0;
    for (const item of workItems) {
      const categoryKey = String(item.category || '').trim().toLowerCase();
      if (!categoryKey || !categoryMap.has(categoryKey)) {
        continue;
      }
      const categoryId = categoryMap.get(categoryKey);
      await db.collection('work_items').updateOne(
        { _id: item._id },
        { $set: { categoryId, updatedAt: new Date() } }
      );
      workItemUpdates += 1;
    }
    console.log(`✅ Updated ${workItemUpdates} work item(s)`);

    console.log('🧩 Backfilling labour entry categoryIds from work items...');
    const workItemCategoryMap = new Map();
    const workItemsWithCategory = await db.collection('work_items').find({
      deletedAt: null,
      categoryId: { $exists: true, $ne: null },
    }).project({ _id: 1, categoryId: 1 }).toArray();

    workItemsWithCategory.forEach((item) => {
      workItemCategoryMap.set(item._id.toString(), item.categoryId);
    });

    const labourEntries = await db.collection('labour_entries').find({
      deletedAt: null,
      workItemId: { $exists: true, $ne: null },
      $or: [
        { categoryId: { $exists: false } },
        { categoryId: null },
      ],
    }).toArray();

    let labourUpdates = 0;
    for (const entry of labourEntries) {
      const workItemId = entry.workItemId?.toString();
      if (!workItemId || !workItemCategoryMap.has(workItemId)) {
        continue;
      }
      const categoryId = workItemCategoryMap.get(workItemId);
      await db.collection('labour_entries').updateOne(
        { _id: entry._id },
        { $set: { categoryId, updatedAt: new Date() } }
      );
      labourUpdates += 1;
    }
    console.log(`✅ Updated ${labourUpdates} labour entry(ies)`);

    console.log('🎉 Backfill completed');
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

backfillCategoryIds();


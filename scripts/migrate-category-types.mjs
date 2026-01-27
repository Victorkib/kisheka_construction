/**
 * Migrate categories to include type + indexes, and seed work item categories.
 *
 * Run with: node scripts/migrate-category-types.mjs
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';
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
const MATERIALS_CATEGORY_TYPE = 'materials';

async function loadWorkItemCategories() {
  const constantsPath = join(__dirname, '..', 'src', 'lib', 'constants', 'work-item-constants.js');
  const module = await import(pathToFileURL(constantsPath).href);
  return Array.isArray(module.WORK_ITEM_CATEGORIES) ? module.WORK_ITEM_CATEGORIES : [];
}

async function migrateCategories() {
  let client;

  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const categoriesCollection = db.collection('categories');

    console.log('🔧 Backfilling missing category types...');
    const backfillResult = await categoriesCollection.updateMany(
      { type: { $exists: false } },
      { $set: { type: MATERIALS_CATEGORY_TYPE, updatedAt: new Date() } }
    );
    console.log(`✅ Updated ${backfillResult.modifiedCount} category record(s)`);

    console.log('🌱 Seeding work item categories...');
    const workItemCategories = await loadWorkItemCategories();
    let createdCount = 0;
    for (const name of workItemCategories) {
      const existing = await categoriesCollection.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        type: WORK_ITEM_CATEGORY_TYPE,
      });
      if (!existing) {
        await categoriesCollection.insertOne({
          name,
          description: '',
          subcategories: [],
          icon: '',
          type: WORK_ITEM_CATEGORY_TYPE,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        createdCount += 1;
      }
    }
    console.log(`✅ Seeded ${createdCount} work item category record(s)`);

    console.log('🧱 Updating category indexes...');
    const existingIndexes = await categoriesCollection.indexes();
    const nameIndex = existingIndexes.find((index) => index.name === 'name_unique');
    if (nameIndex) {
      await categoriesCollection.dropIndex('name_unique');
      console.log('✅ Dropped legacy name_unique index');
    }

    const indexNames = (await categoriesCollection.indexes()).map((index) => index.name);
    if (!indexNames.includes('name_type_unique')) {
      await categoriesCollection.createIndex(
        { name: 1, type: 1 },
        { unique: true, name: 'name_type_unique' }
      );
      console.log('✅ Created name_type_unique index');
    }

    if (!indexNames.includes('type_name_idx')) {
      await categoriesCollection.createIndex(
        { type: 1, name: 1 },
        { name: 'type_name_idx' }
      );
      console.log('✅ Created type_name_idx index');
    }

    console.log('🎉 Category migration completed');
  } catch (error) {
    console.error('❌ Category migration failed:', error);
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

migrateCategories();


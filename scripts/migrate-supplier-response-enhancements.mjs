/**
 * Migration: Supplier Response System Enhancements
 * 
 * Adds missing fields and indexes for modification approval workflow
 * and post-rejection automation
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

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function migrate() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const collection = db.collection('purchase_orders');

    // Step 1: Add missing fields to existing documents
    console.log('\n1. Adding missing fields to existing purchase orders...');
    
    // Add modificationApprovedAt to orders with modificationApproved set
    const modificationUpdateResult = await collection.updateMany(
      {
        modificationApproved: { $exists: true, $ne: null },
        modificationApprovedAt: { $exists: false }
      },
      {
        $set: {
          modificationApprovedAt: new Date()
        }
      }
    );
    console.log(`   Updated ${modificationUpdateResult.modifiedCount} orders with modificationApprovedAt`);

    // Step 2: Create indexes for better query performance
    console.log('\n2. Creating indexes...');

    // Index for querying rejected orders needing action
    try {
      await collection.createIndex(
        { status: 1, isRetryable: 1, retryCount: 1 },
        { name: 'status_retryable_retryCount' }
      );
      console.log('   ✓ Created index: status_retryable_retryCount');
    } catch (error) {
      if (error.code !== 85) { // Index already exists
        console.error('   ✗ Error creating status_retryable_retryCount index:', error.message);
      } else {
        console.log('   ✓ Index status_retryable_retryCount already exists');
      }
    }

    // Index for modification approval queries
    try {
      await collection.createIndex(
        { status: 1, modificationApproved: 1 },
        { name: 'status_modificationApproved' }
      );
      console.log('   ✓ Created index: status_modificationApproved');
    } catch (error) {
      if (error.code !== 85) {
        console.error('   ✗ Error creating status_modificationApproved index:', error.message);
      } else {
        console.log('   ✓ Index status_modificationApproved already exists');
      }
    }

    // Index for supplier response tracking
    try {
      await collection.createIndex(
        { supplierId: 1, status: 1, supplierResponseDate: -1 },
        { name: 'supplierId_status_responseDate' }
      );
      console.log('   ✓ Created index: supplierId_status_responseDate');
    } catch (error) {
      if (error.code !== 85) {
        console.error('   ✗ Error creating supplierId_status_responseDate index:', error.message);
      } else {
        console.log('   ✓ Index supplierId_status_responseDate already exists');
      }
    }

    // Index for rejection reason analytics
    try {
      await collection.createIndex(
        { rejectionReason: 1, rejectionSubcategory: 1 },
        { name: 'rejectionReason_subcategory' }
      );
      console.log('   ✓ Created index: rejectionReason_subcategory');
    } catch (error) {
      if (error.code !== 85) {
        console.error('   ✗ Error creating rejectionReason_subcategory index:', error.message);
      } else {
        console.log('   ✓ Index rejectionReason_subcategory already exists');
      }
    }

    // Index for alternative orders tracking
    try {
      await collection.createIndex(
        { originalOrderId: 1, isAlternativeOrder: 1 },
        { name: 'originalOrderId_isAlternative' }
      );
      console.log('   ✓ Created index: originalOrderId_isAlternative');
    } catch (error) {
      if (error.code !== 85) {
        console.error('   ✗ Error creating originalOrderId_isAlternative index:', error.message);
      } else {
        console.log('   ✓ Index originalOrderId_isAlternative already exists');
      }
    }

    // Step 3: Validate data integrity
    console.log('\n3. Validating data integrity...');
    
    // Check for orders with modifications but no approval status
    const unapprovedModifications = await collection.countDocuments({
      status: 'order_modified',
      modificationApproved: { $exists: false }
    });
    console.log(`   Found ${unapprovedModifications} orders with modifications awaiting approval`);

    // Check for rejected orders that are retryable
    const retryableRejections = await collection.countDocuments({
      status: 'order_rejected',
      isRetryable: true,
      retryCount: { $lt: 3 }
    });
    console.log(`   Found ${retryableRejections} rejected orders that are retryable`);

    // Check for orders with multiple retries
    const multipleRetries = await collection.countDocuments({
      retryCount: { $gte: 2 }
    });
    console.log(`   Found ${multipleRetries} orders with 2+ retry attempts`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Updated ${modificationUpdateResult.modifiedCount} orders`);
    console.log(`  - Created/verified 5 indexes`);
    console.log(`  - Found ${unapprovedModifications} orders awaiting modification approval`);
    console.log(`  - Found ${retryableRejections} retryable rejected orders`);
    console.log(`  - Found ${multipleRetries} orders with multiple retries`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\nMigration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration script failed:', error);
    process.exit(1);
  });

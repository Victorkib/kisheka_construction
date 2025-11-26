/**
 * Migration Script: Link Investors to Users
 * 
 * This script links existing investors to user accounts by matching email addresses.
 * It adds a userId field to investors that have a matching user account.
 * 
 * Run with: npm run migrate:investor-links
 * Or: node scripts/migrate-investor-user-links.mjs
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

async function migrateInvestorUserLinks() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    
    const investorsCollection = db.collection('investors');
    const usersCollection = db.collection('users');
    
    // Get all investors without userId
    const investorsWithoutUserId = await investorsCollection
      .find({ userId: { $exists: false } })
      .toArray();
    
    console.log(`📊 Found ${investorsWithoutUserId.length} investors without userId field\n`);
    
    if (investorsWithoutUserId.length === 0) {
      console.log('✅ All investors already have userId field. Migration not needed.');
      return;
    }
    
    let linkedCount = 0;
    let skippedCount = 0;
    const skippedInvestors = [];
    
    // Process each investor
    for (const investor of investorsWithoutUserId) {
      if (!investor.email) {
        console.log(`⚠️  Skipping investor "${investor.name}" (ID: ${investor._id}) - no email address`);
        skippedCount++;
        skippedInvestors.push({
          investorId: investor._id,
          name: investor.name,
          reason: 'No email address',
        });
        continue;
      }
      
      // Find matching user by email
      const matchingUser = await usersCollection.findOne({
        email: investor.email.toLowerCase().trim(),
      });
      
      if (matchingUser) {
        // Link investor to user
        await investorsCollection.updateOne(
          { _id: investor._id },
          {
            $set: {
              userId: matchingUser._id,
              updatedAt: new Date(),
            },
          }
        );
        
        console.log(`✅ Linked investor "${investor.name}" (${investor.email}) to user ${matchingUser.email}`);
        linkedCount++;
      } else {
        console.log(`⚠️  No matching user found for investor "${investor.name}" (${investor.email})`);
        skippedCount++;
        skippedInvestors.push({
          investorId: investor._id,
          name: investor.name,
          email: investor.email,
          reason: 'No matching user found',
        });
      }
    }
    
    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Linked: ${linkedCount} investors`);
    console.log(`   ⚠️  Skipped: ${skippedCount} investors`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (skippedInvestors.length > 0) {
      console.log('📋 Skipped Investors (manual linking may be required):');
      skippedInvestors.forEach((item) => {
        console.log(`   • ${item.name} (${item.email || 'no email'}) - ${item.reason}`);
      });
      console.log('');
    }
    
    console.log('🎉 Migration completed successfully!');
    
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
migrateInvestorUserLinks()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });


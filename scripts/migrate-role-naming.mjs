/**
 * Role Naming Migration Script
 * Migrates all 'project_manager' roles to 'pm' for consistency
 * 
 * Usage: node scripts/migrate-role-naming.mjs
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

async function migrateRoleNaming() {
  let client;

  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    console.log(`📦 Using database: ${DB_NAME}\n`);

    // Count users with 'project_manager' role
    const usersCollection = db.collection('users');
    const countBefore = await usersCollection.countDocuments({ role: 'project_manager' });

    console.log(`📊 Found ${countBefore} user(s) with 'project_manager' role\n`);

    if (countBefore === 0) {
      console.log('✅ No users to migrate. All roles are already standardized.');
      process.exit(0);
    }

    // Show users that will be migrated
    const usersToMigrate = await usersCollection
      .find({ role: 'project_manager' })
      .toArray();

    console.log('👥 Users to be migrated:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    usersToMigrate.forEach((user) => {
      console.log(`   - ${user.email} (${user.firstName || ''} ${user.lastName || ''})`.trim());
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Confirm migration
    console.log('🔄 Migrating roles from "project_manager" to "pm"...\n');

    // Update users
    const result = await usersCollection.updateMany(
      { role: 'project_manager' },
      {
        $set: {
          role: 'pm',
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✅ Migration completed!`);
    console.log(`   - Matched: ${result.matchedCount} user(s)`);
    console.log(`   - Modified: ${result.modifiedCount} user(s)\n`);

    // Update role_changes collection
    const roleChangesCollection = db.collection('role_changes');
    const roleChangesResult = await roleChangesCollection.updateMany(
      {
        $or: [
          { oldRole: 'project_manager' },
          { newRole: 'project_manager' },
        ],
      },
      [
        {
          $set: {
            oldRole: {
              $cond: {
                if: { $eq: ['$oldRole', 'project_manager'] },
                then: 'pm',
                else: '$oldRole',
              },
            },
            newRole: {
              $cond: {
                if: { $eq: ['$newRole', 'project_manager'] },
                then: 'pm',
                else: '$newRole',
              },
            },
            updatedAt: new Date(),
          },
        },
      ]
    );

    console.log(`📝 Updated role change history:`);
    console.log(`   - Matched: ${roleChangesResult.matchedCount} record(s)`);
    console.log(`   - Modified: ${roleChangesResult.modifiedCount} record(s)\n`);

    // Update invitations collection
    const invitationsCollection = db.collection('invitations');
    const invitationsResult = await invitationsCollection.updateMany(
      { role: 'project_manager' },
      {
        $set: {
          role: 'pm',
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✉️  Updated invitations:`);
    console.log(`   - Matched: ${invitationsResult.matchedCount} invitation(s)`);
    console.log(`   - Modified: ${invitationsResult.modifiedCount} invitation(s)\n`);

    // Verify migration
    const countAfter = await usersCollection.countDocuments({ role: 'project_manager' });
    const countPM = await usersCollection.countDocuments({ role: 'pm' });

    console.log('📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Users with 'project_manager': ${countAfter} (should be 0)`);
    console.log(`   Users with 'pm': ${countPM}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (countAfter === 0) {
      console.log('🎉 Migration completed successfully!');
      console.log('   All roles have been standardized to "pm".\n');
    } else {
      console.warn('⚠️  Warning: Some users still have "project_manager" role.');
      console.warn('   Please review and complete the migration.\n');
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed.\n');
    }
  }
}

// Run migration
migrateRoleNaming();


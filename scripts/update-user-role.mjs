/**
 * Update User Role Script
 * Updates a user's role in the MongoDB database
 * 
 * Run with: node scripts/update-user-role.mjs
 * Or: npm run update:user-role (if added to package.json)
 * 
 * Usage: node scripts/update-user-role.mjs <email> <role>
 * Example: node scripts/update-user-role.mjs qinalexander56@gmail.com owner
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

// Valid roles in the system
const VALID_ROLES = ['owner', 'investor', 'PM', 'project_manager', 'supervisor', 'site_clerk', 'accountant'];

async function updateUserRole(email, newRole) {
  let client;
  
  try {
    // Validate role
    const roleLower = newRole.toLowerCase();
    if (!VALID_ROLES.includes(roleLower)) {
      console.error(`❌ Invalid role: ${newRole}`);
      console.error(`   Valid roles are: ${VALID_ROLES.join(', ')}`);
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    
    // Find user by email
    console.log(`🔍 Searching for user with email: ${email}...`);
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email });
    
    if (!user) {
      console.error(`❌ User with email "${email}" not found in database.`);
      console.error('   Please ensure the user has logged in at least once to create their profile.');
      process.exit(1);
    }
    
    // Show current user info
    console.log('\n📋 Current User Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A');
    console.log(`   Current Role: ${user.role || 'N/A'}`);
    console.log(`   Status: ${user.status || 'N/A'}`);
    console.log(`   Supabase ID: ${user.supabaseId || 'N/A'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Check if role is already set
    if (user.role?.toLowerCase() === roleLower) {
      console.log(`✅ User already has role "${roleLower}". No update needed.`);
      process.exit(0);
    }
    
    // Update user role
    console.log(`🔄 Updating user role from "${user.role || 'N/A'}" to "${roleLower}"...`);
    const result = await usersCollection.updateOne(
      { email },
      {
        $set: {
          role: roleLower,
          updatedAt: new Date(),
        },
      }
    );
    
    if (result.matchedCount === 0) {
      console.error('❌ Failed to find user for update.');
      process.exit(1);
    }
    
    if (result.modifiedCount === 0) {
      console.warn('⚠️  Update completed but no changes were made.');
    } else {
      console.log('✅ User role updated successfully!\n');
      
      // Fetch and display updated user
      const updatedUser = await usersCollection.findOne({ email });
      console.log('📋 Updated User Information:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Name: ${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim() || 'N/A');
      console.log(`   New Role: ${updatedUser.role}`);
      console.log(`   Status: ${updatedUser.status || 'N/A'}`);
      console.log(`   Updated At: ${updatedUser.updatedAt}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
    
    console.log('🎉 Script completed successfully!');
    console.log(`   The user "${email}" now has the role "${roleLower}".`);
    console.log('   Changes have been persisted to the database.\n');
    
  } catch (error) {
    console.error('❌ Error updating user role:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const email = args[0] || 'qinalexander56@gmail.com';
const role = args[1] || 'owner';

// Run the update
updateUserRole(email, role)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });


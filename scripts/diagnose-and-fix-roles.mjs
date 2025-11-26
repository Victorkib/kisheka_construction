/**
 * Comprehensive Role Diagnosis and Fix Script
 * 
 * This script:
 * 1. Diagnoses role inconsistencies in MongoDB
 * 2. Identifies users with invalid/non-normalized roles
 * 3. Fixes role naming issues (project_manager -> pm, case issues, etc.)
 * 4. Updates related collections (role_changes, invitations)
 * 5. Provides detailed reports
 * 
 * Usage: node scripts/diagnose-and-fix-roles.mjs [--fix]
 * 
 * Without --fix: Only diagnoses and reports issues
 * With --fix: Diagnoses and automatically fixes all issues
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

// Valid roles (from role-constants.js)
const VALID_ROLES = [
  'owner',
  'investor',
  'pm',
  'project_manager', // Backward compatibility
  'supervisor',
  'site_clerk',
  'accountant',
  'supplier',
];

/**
 * Normalize role (matches role-constants.js logic)
 */
function normalizeRole(role) {
  if (!role) return null;
  const normalized = String(role).toLowerCase().trim();
  // Normalize 'project_manager' to 'pm'
  if (normalized === 'project_manager') {
    return 'pm';
  }
  return normalized;
}

/**
 * Check if role is valid
 */
function isValidRole(role) {
  if (!role) return false;
  const normalized = normalizeRole(role);
  return VALID_ROLES.some(validRole => normalizeRole(validRole) === normalized);
}

/**
 * Get role display name
 */
function getRoleDisplayName(role) {
  const map = {
    owner: 'Owner',
    investor: 'Investor',
    pm: 'Project Manager',
    project_manager: 'Project Manager',
    supervisor: 'Supervisor',
    site_clerk: 'Clerk',
    accountant: 'Accountant',
    supplier: 'Supplier',
  };
  return map[normalizeRole(role)] || role;
}

async function diagnoseAndFixRoles() {
  let client;
  const shouldFix = process.argv.includes('--fix');

  try {
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in .env.local');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    console.log(`📦 Using database: ${DB_NAME}\n`);

    if (shouldFix) {
      console.log('🔧 FIX MODE: Will automatically fix all issues\n');
    } else {
      console.log('🔍 DIAGNOSE MODE: Will only report issues (use --fix to apply changes)\n');
    }

    // ============================================
    // 1. DIAGNOSE USERS COLLECTION
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 STEP 1: Diagnosing Users Collection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const usersCollection = db.collection('users');
    const allUsers = await usersCollection.find({}).toArray();
    const totalUsers = allUsers.length;

    console.log(`📈 Total users in database: ${totalUsers}\n`);

    // Analyze roles
    const roleStats = {};
    const issues = {
      missingRole: [],
      invalidRole: [],
      nonNormalized: [],
      caseIssues: [],
    };

    allUsers.forEach((user) => {
      const role = user.role;
      
      // Count roles
      const roleKey = role || '(no role)';
      roleStats[roleKey] = (roleStats[roleKey] || 0) + 1;

      // Check for issues
      if (!role) {
        issues.missingRole.push({
          _id: user._id,
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
        });
      } else if (!isValidRole(role)) {
        issues.invalidRole.push({
          _id: user._id,
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
          role: role,
        });
      } else {
        const normalized = normalizeRole(role);
        if (normalized !== role.toLowerCase()) {
          issues.nonNormalized.push({
            _id: user._id,
            email: user.email,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
            currentRole: role,
            normalizedRole: normalized,
          });
        } else if (role !== normalized) {
          issues.caseIssues.push({
            _id: user._id,
            email: user.email,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
            currentRole: role,
            normalizedRole: normalized,
          });
        }
      }
    });

    // Display role statistics
    console.log('📊 Role Distribution:');
    Object.entries(roleStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([role, count]) => {
        const normalized = normalizeRole(role);
        const displayName = getRoleDisplayName(role);
        const marker = normalized && normalized !== role.toLowerCase() ? '⚠️' : '✅';
        console.log(`   ${marker} ${role.padEnd(20)} → ${normalized || '(null)'} (${displayName}): ${count} user(s)`);
      });
    console.log();

    // Display issues
    const totalIssues = 
      issues.missingRole.length +
      issues.invalidRole.length +
      issues.nonNormalized.length +
      issues.caseIssues.length;

    if (totalIssues === 0) {
      console.log('✅ No issues found in users collection!\n');
    } else {
      console.log(`⚠️  Found ${totalIssues} issue(s) in users collection:\n`);

      if (issues.missingRole.length > 0) {
        console.log(`   ❌ Missing Role: ${issues.missingRole.length} user(s)`);
        issues.missingRole.forEach((user) => {
          console.log(`      - ${user.email} (${user.name})`);
        });
        console.log();
      }

      if (issues.invalidRole.length > 0) {
        console.log(`   ❌ Invalid Role: ${issues.invalidRole.length} user(s)`);
        issues.invalidRole.forEach((user) => {
          console.log(`      - ${user.email} (${user.name}): "${user.role}"`);
        });
        console.log();
      }

      if (issues.nonNormalized.length > 0) {
        console.log(`   ⚠️  Non-Normalized Role: ${issues.nonNormalized.length} user(s)`);
        issues.nonNormalized.forEach((user) => {
          console.log(`      - ${user.email} (${user.name}): "${user.currentRole}" → "${user.normalizedRole}"`);
        });
        console.log();
      }

      if (issues.caseIssues.length > 0) {
        console.log(`   ⚠️  Case Issues: ${issues.caseIssues.length} user(s)`);
        issues.caseIssues.forEach((user) => {
          console.log(`      - ${user.email} (${user.name}): "${user.currentRole}" → "${user.normalizedRole}"`);
        });
        console.log();
      }

      // Fix issues if --fix flag is set
      if (shouldFix) {
        console.log('🔧 Fixing issues in users collection...\n');

        // Fix non-normalized roles (project_manager -> pm)
        const nonNormalizedIds = issues.nonNormalized.map(u => u._id);
        if (nonNormalizedIds.length > 0) {
          const updates = issues.nonNormalized.map((user) => ({
            updateOne: {
              filter: { _id: user._id },
              update: {
                $set: {
                  role: user.normalizedRole,
                  updatedAt: new Date(),
                },
              },
            },
          }));

          const result = await usersCollection.bulkWrite(updates);
          console.log(`   ✅ Fixed ${result.modifiedCount} non-normalized role(s)`);
        }

        // Fix case issues
        const caseIssueIds = issues.caseIssues.map(u => u._id);
        if (caseIssueIds.length > 0) {
          const updates = issues.caseIssues.map((user) => ({
            updateOne: {
              filter: { _id: user._id },
              update: {
                $set: {
                  role: user.normalizedRole,
                  updatedAt: new Date(),
                },
              },
            },
          }));

          const result = await usersCollection.bulkWrite(updates);
          console.log(`   ✅ Fixed ${result.modifiedCount} case issue(s)`);
        }

        console.log();
      }
    }

    // ============================================
    // 2. DIAGNOSE ROLE_CHANGES COLLECTION
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 STEP 2: Diagnosing Role Changes Collection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const roleChangesCollection = db.collection('role_changes');
    const allRoleChanges = await roleChangesCollection.find({}).toArray();
    const totalRoleChanges = allRoleChanges.length;

    console.log(`📈 Total role change records: ${totalRoleChanges}\n`);

    const roleChangeIssues = {
      nonNormalizedOldRole: [],
      nonNormalizedNewRole: [],
    };

    allRoleChanges.forEach((change) => {
      if (change.oldRole) {
        const normalized = normalizeRole(change.oldRole);
        if (normalized !== change.oldRole.toLowerCase()) {
          roleChangeIssues.nonNormalizedOldRole.push(change);
        }
      }
      if (change.newRole) {
        const normalized = normalizeRole(change.newRole);
        if (normalized !== change.newRole.toLowerCase()) {
          roleChangeIssues.nonNormalizedNewRole.push(change);
        }
      }
    });

    const totalRoleChangeIssues = 
      roleChangeIssues.nonNormalizedOldRole.length +
      roleChangeIssues.nonNormalizedNewRole.length;

    if (totalRoleChangeIssues === 0) {
      console.log('✅ No issues found in role_changes collection!\n');
    } else {
      console.log(`⚠️  Found ${totalRoleChangeIssues} issue(s) in role_changes collection:\n`);

      if (roleChangeIssues.nonNormalizedOldRole.length > 0) {
        console.log(`   ⚠️  Non-Normalized Old Role: ${roleChangeIssues.nonNormalizedOldRole.length} record(s)`);
      }

      if (roleChangeIssues.nonNormalizedNewRole.length > 0) {
        console.log(`   ⚠️  Non-Normalized New Role: ${roleChangeIssues.nonNormalizedNewRole.length} record(s)`);
      }
      console.log();

      if (shouldFix) {
        console.log('🔧 Fixing issues in role_changes collection...\n');

        const updates = [];
        allRoleChanges.forEach((change) => {
          const normalizedOldRole = change.oldRole ? normalizeRole(change.oldRole) : change.oldRole;
          const normalizedNewRole = change.newRole ? normalizeRole(change.newRole) : change.newRole;

          if (normalizedOldRole !== change.oldRole || normalizedNewRole !== change.newRole) {
            updates.push({
              updateOne: {
                filter: { _id: change._id },
                update: {
                  $set: {
                    oldRole: normalizedOldRole,
                    newRole: normalizedNewRole,
                    updatedAt: new Date(),
                  },
                },
              },
            });
          }
        });

        if (updates.length > 0) {
          const result = await roleChangesCollection.bulkWrite(updates);
          console.log(`   ✅ Fixed ${result.modifiedCount} role change record(s)\n`);
        }
      }
    }

    // ============================================
    // 3. DIAGNOSE INVITATIONS COLLECTION
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 STEP 3: Diagnosing Invitations Collection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const invitationsCollection = db.collection('invitations');
    const allInvitations = await invitationsCollection.find({}).toArray();
    const totalInvitations = allInvitations.length;

    console.log(`📈 Total invitations: ${totalInvitations}\n`);

    const invitationIssues = {
      nonNormalized: [],
    };

    allInvitations.forEach((invitation) => {
      if (invitation.role) {
        const normalized = normalizeRole(invitation.role);
        if (normalized !== invitation.role.toLowerCase()) {
          invitationIssues.nonNormalized.push({
            _id: invitation._id,
            email: invitation.email,
            role: invitation.role,
            normalizedRole: normalized,
          });
        }
      }
    });

    if (invitationIssues.nonNormalized.length === 0) {
      console.log('✅ No issues found in invitations collection!\n');
    } else {
      console.log(`⚠️  Found ${invitationIssues.nonNormalized.length} issue(s) in invitations collection:\n`);

      invitationIssues.nonNormalized.forEach((inv) => {
        console.log(`   - ${inv.email}: "${inv.role}" → "${inv.normalizedRole}"`);
      });
      console.log();

      if (shouldFix) {
        console.log('🔧 Fixing issues in invitations collection...\n');

        const updates = invitationIssues.nonNormalized.map((inv) => ({
          updateOne: {
            filter: { _id: inv._id },
            update: {
              $set: {
                role: inv.normalizedRole,
                updatedAt: new Date(),
              },
            },
          },
        }));

        const result = await invitationsCollection.bulkWrite(updates);
        console.log(`   ✅ Fixed ${result.modifiedCount} invitation(s)\n`);
      }
    }

    // ============================================
    // 4. FINAL SUMMARY
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 FINAL SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const grandTotalIssues = 
      totalIssues + 
      totalRoleChangeIssues + 
      invitationIssues.nonNormalized.length;

    if (grandTotalIssues === 0) {
      console.log('🎉 All checks passed! No issues found in the database.\n');
      console.log('✅ All roles are properly normalized and valid.\n');
    } else {
      if (shouldFix) {
        console.log(`✅ Fixed ${grandTotalIssues} total issue(s) across all collections.\n`);
        console.log('💡 Please re-run this script without --fix to verify all issues are resolved.\n');
      } else {
        console.log(`⚠️  Found ${grandTotalIssues} total issue(s) that need to be fixed.\n`);
        console.log('💡 Run with --fix flag to automatically fix all issues:\n');
        console.log('   node scripts/diagnose-and-fix-roles.mjs --fix\n');
      }
    }

    // Verify specific user if ID provided
    const userIdArg = process.argv.find(arg => arg.startsWith('--user='));
    if (userIdArg) {
      const userId = userIdArg.split('=')[1];
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🔍 Verifying User: ${userId}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      if (ObjectId.isValid(userId)) {
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (user) {
          console.log('📋 User Details:');
          console.log(`   Email: ${user.email}`);
          console.log(`   Name: ${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A');
          console.log(`   Role: ${user.role || '(no role)'}`);
          console.log(`   Normalized Role: ${normalizeRole(user.role) || '(null)'}`);
          console.log(`   Valid: ${isValidRole(user.role) ? '✅' : '❌'}`);
          console.log(`   Status: ${user.status || 'N/A'}\n`);
        } else {
          console.log(`❌ User with ID ${userId} not found.\n`);
        }
      } else {
        console.log(`❌ Invalid user ID format: ${userId}\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed.\n');
    }
  }
}

// Run the script
diagnoseAndFixRoles()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });


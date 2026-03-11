/**
 * Notification Data Integrity Verification Script
 * Checks for corrupted, orphaned, or invalid notification data
 * 
 * Usage: node scripts/verify-notification-data.mjs [--fix]
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

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

const FIX_MODE = process.argv.includes('--fix');

async function verifyNotificationData() {
  let client;
  
  try {
    console.log('🔍 Starting Notification Data Integrity Check...\n');
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const notificationsCollection = db.collection('notifications');
    const usersCollection = db.collection('users');
    const projectsCollection = db.collection('projects');
    
    // Get all notifications
    const allNotifications = await notificationsCollection.find({}).toArray();
    const totalCount = allNotifications.length;
    
    console.log(`📊 Total notifications in database: ${totalCount}\n`);
    
    if (totalCount === 0) {
      console.log('✅ No notifications found. Database is clean.\n');
      return;
    }
    
    // Track issues
    const issues = {
      invalidUserId: [],
      orphanedUser: [],
      invalidProjectId: [],
      orphanedProject: [],
      invalidRelatedId: [],
      missingRequiredFields: [],
      invalidType: [],
      invalidDates: [],
      duplicateNotifications: [],
    };
    
    // Valid notification types
    const validTypes = [
      'approval_needed',
      'approval_required',
      'approval_status',
      'budget_alert',
      'discrepancy_alert',
      'item_received',
      'task_assigned',
      'comment',
      'role_changed',
      'invitation_sent',
      'bulk_request_created',
      'bulk_request_approved',
      'bulk_po_created',
      'template_used',
      'bulk_materials_created',
      'purchase_order_created',
    ];
    
    // Get all valid user IDs
    const validUserIds = new Set();
    const users = await usersCollection.find({}).project({ _id: 1 }).toArray();
    users.forEach(user => {
      validUserIds.add(user._id.toString());
    });
    
    // Get all valid project IDs
    const validProjectIds = new Set();
    const projects = await projectsCollection.find({ deletedAt: null }).project({ _id: 1 }).toArray();
    projects.forEach(project => {
      validProjectIds.add(project._id.toString());
    });
    
    console.log(`📋 Valid users: ${validUserIds.size}`);
    console.log(`📋 Valid projects: ${validProjectIds.size}\n`);
    
    // Check each notification
    for (const notification of allNotifications) {
      const notifId = notification._id.toString();
      
      // Check userId
      if (!notification.userId) {
        issues.missingRequiredFields.push({
          id: notifId,
          field: 'userId',
          issue: 'Missing userId',
        });
      } else {
        const userId = notification.userId.toString();
        if (!ObjectId.isValid(userId)) {
          issues.invalidUserId.push({
            id: notifId,
            userId,
            issue: 'Invalid userId format',
          });
        } else if (!validUserIds.has(userId)) {
          issues.orphanedUser.push({
            id: notifId,
            userId,
            issue: 'UserId references non-existent user',
          });
        }
      }
      
      // Check projectId (optional field)
      if (notification.projectId) {
        const projectId = notification.projectId.toString();
        if (!ObjectId.isValid(projectId)) {
          issues.invalidProjectId.push({
            id: notifId,
            projectId,
            issue: 'Invalid projectId format',
          });
        } else if (!validProjectIds.has(projectId)) {
          issues.orphanedProject.push({
            id: notifId,
            projectId,
            issue: 'ProjectId references non-existent or deleted project',
          });
        }
      }
      
      // Check relatedId (optional field)
      if (notification.relatedId) {
        const relatedId = notification.relatedId.toString();
        if (!ObjectId.isValid(relatedId)) {
          issues.invalidRelatedId.push({
            id: notifId,
            relatedId,
            issue: 'Invalid relatedId format',
          });
        }
      }
      
      // Check required fields
      if (!notification.type) {
        issues.missingRequiredFields.push({
          id: notifId,
          field: 'type',
          issue: 'Missing type',
        });
      } else if (!validTypes.includes(notification.type)) {
        issues.invalidType.push({
          id: notifId,
          type: notification.type,
          issue: 'Invalid notification type',
        });
      }
      
      if (!notification.title) {
        issues.missingRequiredFields.push({
          id: notifId,
          field: 'title',
          issue: 'Missing title',
        });
      }
      
      if (!notification.message) {
        issues.missingRequiredFields.push({
          id: notifId,
          field: 'message',
          issue: 'Missing message',
        });
      }
      
      // Check dates
      if (!notification.createdAt) {
        issues.missingRequiredFields.push({
          id: notifId,
          field: 'createdAt',
          issue: 'Missing createdAt',
        });
      } else {
        const createdAt = new Date(notification.createdAt);
        if (isNaN(createdAt.getTime())) {
          issues.invalidDates.push({
            id: notifId,
            date: notification.createdAt,
            issue: 'Invalid createdAt date',
          });
        } else if (createdAt > new Date()) {
          issues.invalidDates.push({
            id: notifId,
            date: notification.createdAt,
            issue: 'CreatedAt is in the future',
          });
        }
      }
      
      if (notification.readAt) {
        const readAt = new Date(notification.readAt);
        if (isNaN(readAt.getTime())) {
          issues.invalidDates.push({
            id: notifId,
            date: notification.readAt,
            issue: 'Invalid readAt date',
          });
        }
      }
      
      // Check isRead consistency
      if (notification.isRead && !notification.readAt) {
        issues.missingRequiredFields.push({
          id: notifId,
          field: 'readAt',
          issue: 'isRead is true but readAt is missing',
        });
      }
      
      if (!notification.isRead && notification.readAt) {
        issues.missingRequiredFields.push({
          id: notifId,
          field: 'isRead',
          issue: 'readAt exists but isRead is false',
        });
      }
    }
    
    // Check for duplicates (same userId, type, title, message, createdAt within 1 second)
    const duplicateMap = new Map();
    for (const notification of allNotifications) {
      const key = `${notification.userId?.toString() || 'null'}_${notification.type}_${notification.title}_${notification.message}_${notification.createdAt?.getTime() || 'null'}`;
      if (duplicateMap.has(key)) {
        duplicateMap.get(key).push(notification._id.toString());
      } else {
        duplicateMap.set(key, [notification._id.toString()]);
      }
    }
    
    for (const [key, ids] of duplicateMap.entries()) {
      if (ids.length > 1) {
        issues.duplicateNotifications.push({
          ids,
          count: ids.length,
          issue: 'Duplicate notifications found',
        });
      }
    }
    
    // Report issues
    console.log('📋 ISSUE SUMMARY:\n');
    console.log(`   Invalid UserId: ${issues.invalidUserId.length}`);
    console.log(`   Orphaned User References: ${issues.orphanedUser.length}`);
    console.log(`   Invalid ProjectId: ${issues.invalidProjectId.length}`);
    console.log(`   Orphaned Project References: ${issues.orphanedProject.length}`);
    console.log(`   Invalid RelatedId: ${issues.invalidRelatedId.length}`);
    console.log(`   Missing Required Fields: ${issues.missingRequiredFields.length}`);
    console.log(`   Invalid Types: ${issues.invalidType.length}`);
    console.log(`   Invalid Dates: ${issues.invalidDates.length}`);
    console.log(`   Duplicate Notifications: ${issues.duplicateNotifications.length}\n`);
    
    const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
    
    if (totalIssues === 0) {
      console.log('✅ No issues found! Notification data is clean.\n');
      return;
    }
    
    console.log(`⚠️  Total issues found: ${totalIssues}\n`);
    
    // Show details for each issue type
    if (issues.invalidUserId.length > 0) {
      console.log('❌ Invalid UserId:');
      issues.invalidUserId.slice(0, 5).forEach(issue => {
        console.log(`   - Notification ${issue.id}: ${issue.issue} (${issue.userId})`);
      });
      if (issues.invalidUserId.length > 5) {
        console.log(`   ... and ${issues.invalidUserId.length - 5} more`);
      }
      console.log();
    }
    
    if (issues.orphanedUser.length > 0) {
      console.log('⚠️  Orphaned User References:');
      issues.orphanedUser.slice(0, 5).forEach(issue => {
        console.log(`   - Notification ${issue.id}: ${issue.issue} (${issue.userId})`);
      });
      if (issues.orphanedUser.length > 5) {
        console.log(`   ... and ${issues.orphanedUser.length - 5} more`);
      }
      console.log();
    }
    
    if (issues.invalidProjectId.length > 0) {
      console.log('❌ Invalid ProjectId:');
      issues.invalidProjectId.slice(0, 5).forEach(issue => {
        console.log(`   - Notification ${issue.id}: ${issue.issue} (${issue.projectId})`);
      });
      if (issues.invalidProjectId.length > 5) {
        console.log(`   ... and ${issues.invalidProjectId.length - 5} more`);
      }
      console.log();
    }
    
    if (issues.orphanedProject.length > 0) {
      console.log('⚠️  Orphaned Project References:');
      issues.orphanedProject.slice(0, 5).forEach(issue => {
        console.log(`   - Notification ${issue.id}: ${issue.issue} (${issue.projectId})`);
      });
      if (issues.orphanedProject.length > 5) {
        console.log(`   ... and ${issues.orphanedProject.length - 5} more`);
      }
      console.log();
    }
    
    if (issues.missingRequiredFields.length > 0) {
      console.log('❌ Missing Required Fields:');
      issues.missingRequiredFields.slice(0, 10).forEach(issue => {
        console.log(`   - Notification ${issue.id}: ${issue.issue} (${issue.field})`);
      });
      if (issues.missingRequiredFields.length > 10) {
        console.log(`   ... and ${issues.missingRequiredFields.length - 10} more`);
      }
      console.log();
    }
    
    if (issues.invalidType.length > 0) {
      console.log('❌ Invalid Types:');
      issues.invalidType.slice(0, 10).forEach(issue => {
        console.log(`   - Notification ${issue.id}: ${issue.issue} (${issue.type})`);
      });
      if (issues.invalidType.length > 10) {
        console.log(`   ... and ${issues.invalidType.length - 10} more`);
      }
      console.log();
    }
    
    if (issues.duplicateNotifications.length > 0) {
      console.log('⚠️  Duplicate Notifications:');
      issues.duplicateNotifications.slice(0, 5).forEach(issue => {
        console.log(`   - ${issue.count} duplicates found (IDs: ${issue.ids.slice(0, 3).join(', ')}${issue.ids.length > 3 ? '...' : ''})`);
      });
      if (issues.duplicateNotifications.length > 5) {
        console.log(`   ... and ${issues.duplicateNotifications.length - 5} more groups`);
      }
      console.log();
    }
    
    // Fix mode
    if (FIX_MODE) {
      console.log('🔧 FIX MODE: Attempting to fix issues...\n');
      
      let fixedCount = 0;
      let deletedCount = 0;
      
      // Fix orphaned project references - remove projectId
      if (issues.orphanedProject.length > 0) {
        console.log(`   Fixing ${issues.orphanedProject.length} orphaned project references...`);
        for (const issue of issues.orphanedProject) {
          await notificationsCollection.updateOne(
            { _id: new ObjectId(issue.id) },
            { $unset: { projectId: '' } }
          );
          fixedCount++;
        }
        console.log(`   ✅ Fixed ${issues.orphanedProject.length} orphaned project references\n`);
      }
      
      // Fix invalid projectId format - remove invalid projectId
      if (issues.invalidProjectId.length > 0) {
        console.log(`   Fixing ${issues.invalidProjectId.length} invalid projectId formats...`);
        for (const issue of issues.invalidProjectId) {
          await notificationsCollection.updateOne(
            { _id: new ObjectId(issue.id) },
            { $unset: { projectId: '' } }
          );
          fixedCount++;
        }
        console.log(`   ✅ Fixed ${issues.invalidProjectId.length} invalid projectId formats\n`);
      }
      
      // Fix invalid relatedId format - remove invalid relatedId
      if (issues.invalidRelatedId.length > 0) {
        console.log(`   Fixing ${issues.invalidRelatedId.length} invalid relatedId formats...`);
        for (const issue of issues.invalidRelatedId) {
          await notificationsCollection.updateOne(
            { _id: new ObjectId(issue.id) },
            { $unset: { relatedId: '' } }
          );
          fixedCount++;
        }
        console.log(`   ✅ Fixed ${issues.invalidRelatedId.length} invalid relatedId formats\n`);
      }
      
      // Fix isRead/readAt inconsistencies
      const inconsistentRead = issues.missingRequiredFields.filter(
        issue => issue.field === 'readAt' || issue.field === 'isRead'
      );
      if (inconsistentRead.length > 0) {
        console.log(`   Fixing ${inconsistentRead.length} read status inconsistencies...`);
        for (const issue of inconsistentRead) {
          if (issue.field === 'readAt') {
            // isRead is true but readAt is missing - add readAt
            await notificationsCollection.updateOne(
              { _id: new ObjectId(issue.id) },
              { $set: { readAt: new Date() } }
            );
          } else {
            // readAt exists but isRead is false - set isRead to true
            await notificationsCollection.updateOne(
              { _id: new ObjectId(issue.id) },
              { $set: { isRead: true } }
            );
          }
          fixedCount++;
        }
        console.log(`   ✅ Fixed ${inconsistentRead.length} read status inconsistencies\n`);
      }
      
      // Delete notifications with invalid userId (can't be fixed)
      if (issues.invalidUserId.length > 0) {
        console.log(`   ⚠️  Deleting ${issues.invalidUserId.length} notifications with invalid userId...`);
        const invalidIds = issues.invalidUserId.map(issue => new ObjectId(issue.id));
        const result = await notificationsCollection.deleteMany({ _id: { $in: invalidIds } });
        deletedCount += result.deletedCount;
        console.log(`   ✅ Deleted ${result.deletedCount} notifications with invalid userId\n`);
      }
      
      // Delete notifications with orphaned user references (user doesn't exist)
      if (issues.orphanedUser.length > 0) {
        console.log(`   ⚠️  Deleting ${issues.orphanedUser.length} notifications with orphaned user references...`);
        const orphanedIds = issues.orphanedUser.map(issue => new ObjectId(issue.id));
        const result = await notificationsCollection.deleteMany({ _id: { $in: orphanedIds } });
        deletedCount += result.deletedCount;
        console.log(`   ✅ Deleted ${result.deletedCount} notifications with orphaned user references\n`);
      }
      
      // Delete notifications missing critical required fields
      const criticalMissing = issues.missingRequiredFields.filter(
        issue => ['userId', 'type', 'title', 'message', 'createdAt'].includes(issue.field)
      );
      if (criticalMissing.length > 0) {
        const criticalIds = [...new Set(criticalMissing.map(issue => issue.id))];
        console.log(`   ⚠️  Deleting ${criticalIds.length} notifications missing critical fields...`);
        const result = await notificationsCollection.deleteMany({
          _id: { $in: criticalIds.map(id => new ObjectId(id)) }
        });
        deletedCount += result.deletedCount;
        console.log(`   ✅ Deleted ${result.deletedCount} notifications missing critical fields\n`);
      }
      
      // Remove duplicate notifications (keep the oldest one)
      if (issues.duplicateNotifications.length > 0) {
        console.log(`   Fixing ${issues.duplicateNotifications.length} duplicate notification groups...`);
        for (const duplicate of issues.duplicateNotifications) {
          // Sort by createdAt, keep the oldest
          const duplicateDocs = await notificationsCollection.find({
            _id: { $in: duplicate.ids.map(id => new ObjectId(id)) }
          }).sort({ createdAt: 1 }).toArray();
          
          if (duplicateDocs.length > 1) {
            // Keep the first (oldest), delete the rest
            const idsToDelete = duplicateDocs.slice(1).map(doc => doc._id);
            const result = await notificationsCollection.deleteMany({
              _id: { $in: idsToDelete }
            });
            deletedCount += result.deletedCount;
            fixedCount += duplicateDocs.length - 1;
          }
        }
        console.log(`   ✅ Fixed duplicate notifications\n`);
      }
      
      console.log(`\n✅ FIX SUMMARY:`);
      console.log(`   Fixed: ${fixedCount} notifications`);
      console.log(`   Deleted: ${deletedCount} corrupted notifications`);
      console.log(`   Remaining issues: ${totalIssues - fixedCount - deletedCount}\n`);
    } else {
      console.log('\n💡 To automatically fix issues, run with --fix flag:');
      console.log('   node scripts/verify-notification-data.mjs --fix\n');
    }
    
  } catch (error) {
    console.error('❌ Error verifying notification data:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('✅ Database connection closed\n');
    }
  }
}

// Run verification
verifyNotificationData()
  .then(() => {
    console.log('✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });

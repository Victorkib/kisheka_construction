/**
 * Migration Script: Project Memberships System
 * 
 * Creates project_memberships and user_project_preferences collections
 * Migrates existing project team data to new structure
 * 
 * Usage: node scripts/migrate-project-memberships.mjs
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
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

async function migrateProjectMemberships() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    
    console.log('✅ Connected to MongoDB');
    
    // Step 1: Create project_memberships collection
    console.log('\n📦 Step 1: Creating project_memberships collection...');
    
    const membershipsCollection = db.collection('project_memberships');
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'project_memberships' }).toArray();
    if (collections.length > 0) {
      console.log('⚠️  project_memberships collection already exists');
      const count = await membershipsCollection.countDocuments();
      console.log(`   Current document count: ${count}`);
      
      // Ask if we should clear it (for test data)
      console.log('🗑️  Clearing existing data (test environment)...');
      await membershipsCollection.deleteMany({});
      console.log('✅ Cleared existing data');
    }
    
    // Create indexes
    console.log('📇 Creating indexes...');
    await membershipsCollection.createIndex({ userId: 1, status: 1 });
    await membershipsCollection.createIndex({ projectId: 1, status: 1 });
    await membershipsCollection.createIndex({ userId: 1, projectId: 1 }, { unique: true });
    console.log('✅ Indexes created');
    
    // Step 2: Create user_project_preferences collection
    console.log('\n📦 Step 2: Creating user_project_preferences collection...');
    
    const preferencesCollection = db.collection('user_project_preferences');
    
    // Check if collection exists
    const prefCollections = await db.listCollections({ name: 'user_project_preferences' }).toArray();
    if (prefCollections.length > 0) {
      console.log('⚠️  user_project_preferences collection already exists');
      const count = await preferencesCollection.countDocuments();
      console.log(`   Current document count: ${count}`);
      
      // Ask if we should clear it (for test data)
      console.log('🗑️  Clearing existing data (test environment)...');
      await preferencesCollection.deleteMany({});
      console.log('✅ Cleared existing data');
    }
    
    // Create indexes
    console.log('📇 Creating indexes...');
    await preferencesCollection.createIndex({ userId: 1 }, { unique: true });
    console.log('✅ Indexes created');
    
    // Step 3: Migrate existing project team data
    console.log('\n🔄 Step 3: Migrating existing project team data...');
    
    const projectsCollection = db.collection('projects');
    const usersCollection = db.collection('users');
    
    const projects = await projectsCollection.find({ deletedAt: null }).toArray();
    console.log(`   Found ${projects.length} projects to process`);
    
    let membershipsCreated = 0;
    let preferencesCreated = 0;
    const processedUsers = new Set();
    
    for (const project of projects) {
      const projectId = project._id;
      
      // Migrate siteManager
      if (project.siteManager && ObjectId.isValid(project.siteManager)) {
        const userId = new ObjectId(project.siteManager);
        
        // Check if user exists
        const user = await usersCollection.findOne({ _id: userId });
        if (user) {
          // Check if membership already exists
          const existing = await membershipsCollection.findOne({
            userId: userId,
            projectId: projectId,
          });
          
          if (!existing) {
            await membershipsCollection.insertOne({
              userId: userId,
              projectId: projectId,
              role: 'pm', // Project Manager
              permissions: [],
              joinedAt: project.createdAt || new Date(),
              removedAt: null,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            membershipsCreated++;
            processedUsers.add(userId.toString());
          }
        }
      }
      
      // Migrate teamMembers
      if (Array.isArray(project.teamMembers)) {
        for (const memberId of project.teamMembers) {
          if (ObjectId.isValid(memberId)) {
            const userId = new ObjectId(memberId);
            
            // Check if user exists
            const user = await usersCollection.findOne({ _id: userId });
            if (user) {
              // Check if membership already exists
              const existing = await membershipsCollection.findOne({
                userId: userId,
                projectId: projectId,
              });
              
              if (!existing) {
                // Determine role based on user's global role
                const userRole = user.role?.toLowerCase() || 'site_clerk';
                let projectRole = 'site_clerk';
                
                if (['owner', 'pm', 'project_manager'].includes(userRole)) {
                  projectRole = 'pm';
                } else if (userRole === 'supervisor') {
                  projectRole = 'supervisor';
                } else if (userRole === 'accountant') {
                  projectRole = 'accountant';
                }
                
                await membershipsCollection.insertOne({
                  userId: userId,
                  projectId: projectId,
                  role: projectRole,
                  permissions: [],
                  joinedAt: project.createdAt || new Date(),
                  removedAt: null,
                  status: 'active',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
                membershipsCreated++;
                processedUsers.add(userId.toString());
              }
            }
          }
        }
      }
      
      // Migrate createdBy
      if (project.createdBy && ObjectId.isValid(project.createdBy)) {
        const userId = new ObjectId(project.createdBy);
        
        // Check if user exists
        const user = await usersCollection.findOne({ _id: userId });
        if (user) {
          // Check if membership already exists
          const existing = await membershipsCollection.findOne({
            userId: userId,
            projectId: projectId,
          });
          
          if (!existing) {
            await membershipsCollection.insertOne({
              userId: userId,
              projectId: projectId,
              role: 'owner', // Creator is owner
              permissions: [],
              joinedAt: project.createdAt || new Date(),
              removedAt: null,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            membershipsCreated++;
            processedUsers.add(userId.toString());
          }
        }
      }
    }
    
    console.log(`✅ Created ${membershipsCreated} project memberships`);
    
    // Step 4: Create default preferences for all users
    console.log('\n👤 Step 4: Creating default user preferences...');
    
    const allUsers = await usersCollection.find({}).toArray();
    console.log(`   Found ${allUsers.length} users to process`);
    
    for (const user of allUsers) {
      // Check if preferences already exist
      const existing = await preferencesCollection.findOne({
        userId: user._id,
      });
      
      if (!existing) {
        // Find user's first project (if any)
        const firstMembership = await membershipsCollection.findOne(
          { userId: user._id, status: 'active' },
          { sort: { joinedAt: 1 } }
        );
        
        await preferencesCollection.insertOne({
          userId: user._id,
          lastProjectId: firstMembership?.projectId || null,
          favoriteProjects: [],
          recentProjects: firstMembership ? [firstMembership.projectId] : [],
          updatedAt: new Date(),
        });
        preferencesCreated++;
      }
    }
    
    console.log(`✅ Created ${preferencesCreated} user preferences`);
    
    // Step 5: Migrate investor project allocations
    console.log('\n💰 Step 5: Migrating investor project allocations...');
    
    const investorsCollection = db.collection('investors');
    const investors = await investorsCollection.find({ status: 'ACTIVE' }).toArray();
    console.log(`   Found ${investors.length} active investors`);
    
    let investorMembershipsCreated = 0;
    
    for (const investor of investors) {
      if (!investor.userId || !ObjectId.isValid(investor.userId)) {
        continue;
      }
      
      const userId = new ObjectId(investor.userId);
      
      // Check if user exists
      const user = await usersCollection.findOne({ _id: userId });
      if (!user) {
        continue;
      }
      
      // Process project allocations
      if (Array.isArray(investor.projectAllocations)) {
        for (const allocation of investor.projectAllocations) {
          if (allocation.projectId && ObjectId.isValid(allocation.projectId)) {
            const projectId = new ObjectId(allocation.projectId);
            
            // Verify project exists
            const project = await projectsCollection.findOne({ _id: projectId });
            if (!project) {
              continue;
            }
            
            // Check if membership already exists
            const existing = await membershipsCollection.findOne({
              userId: userId,
              projectId: projectId,
            });
            
            if (!existing) {
              await membershipsCollection.insertOne({
                userId: userId,
                projectId: projectId,
                role: 'investor',
                permissions: ['view_reports', 'view_finances'],
                joinedAt: allocation.allocatedAt || investor.createdAt || new Date(),
                removedAt: null,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              investorMembershipsCreated++;
            }
          }
        }
      }
    }
    
    console.log(`✅ Created ${investorMembershipsCreated} investor memberships`);
    
    // Final summary
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Project memberships created: ${membershipsCreated + investorMembershipsCreated}`);
    console.log(`   ✅ User preferences created: ${preferencesCreated}`);
    console.log(`   ✅ Total users processed: ${processedUsers.size}`);
    
    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const totalMemberships = await membershipsCollection.countDocuments();
    const totalPreferences = await preferencesCollection.countDocuments();
    
    console.log(`   Total memberships in database: ${totalMemberships}`);
    console.log(`   Total preferences in database: ${totalPreferences}`);
    
    if (totalMemberships > 0 && totalPreferences > 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed, but no data was migrated.');
      console.log('   This is normal if there are no existing projects or users.');
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Run migration
migrateProjectMemberships()
  .then(() => {
    console.log('\n🎉 Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });








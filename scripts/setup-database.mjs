/**
 * Database Setup Script
 * Creates all collections and indexes for the Kisheka Construction Accountability System
 * 
 * Run with: npm run setup:db
 * Or: node scripts/setup-database.mjs
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

async function setupDatabase() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    
    // ============================================
    // 1. USERS COLLECTION
    // ============================================
    console.log('📝 Setting up users collection...');
    const usersCollection = db.collection('users');
    
    // Create indexes
    await usersCollection.createIndex({ supabaseId: 1 }, { unique: true, name: 'supabaseId_unique' });
    await usersCollection.createIndex({ email: 1 }, { unique: true, name: 'email_unique' });
    await usersCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    await usersCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    await usersCollection.createIndex({ role: 1 }, { name: 'role_idx' });
    console.log('✅ Users collection ready\n');
    
    // ============================================
    // 2. PROJECTS COLLECTION
    // ============================================
    console.log('📝 Setting up projects collection...');
    const projectsCollection = db.collection('projects');
    
    await projectsCollection.createIndex({ projectCode: 1 }, { unique: true, name: 'projectCode_unique' });
    await projectsCollection.createIndex({ projectName: 1 }, { name: 'projectName_idx' });
    await projectsCollection.createIndex({ location: 1 }, { name: 'location_idx' });
    await projectsCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    await projectsCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    await projectsCollection.createIndex({ 'budget.total': 1 }, { name: 'budget_total_idx' });
    console.log('✅ Projects collection ready\n');

    // ============================================
    // 2a. CATEGORIES COLLECTION (Phase 2)
    // ============================================
    console.log('📝 Setting up categories collection...');
    const categoriesCollection = db.collection('categories');
    
    await categoriesCollection.createIndex({ name: 1 }, { unique: true, name: 'name_unique' });
    await categoriesCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    console.log('✅ Categories collection ready\n');

    // ============================================
    // 2b. FLOORS COLLECTION (Phase 2)
    // ============================================
    console.log('📝 Setting up floors collection...');
    const floorsCollection = db.collection('floors');
    
    await floorsCollection.createIndex({ floorNumber: 1 }, { unique: true, name: 'floorNumber_unique' });
    await floorsCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    await floorsCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    console.log('✅ Floors collection ready\n');
    
    // ============================================
    // 3. MATERIALS COLLECTION
    // ============================================
    console.log('📝 Setting up materials collection...');
    const materialsCollection = db.collection('materials');
    
    // Partial unique index: only indexes documents where materialCode exists and is a valid type
    // Allows multiple materials per project without materialCode
    await materialsCollection.createIndex(
      { projectId: 1, materialCode: 1 },
      {
        unique: true,
        partialFilterExpression: { materialCode: { $exists: true, $type: ['string', 'number'] } },
        name: 'project_materialCode_unique_partial'
      }
    );
    await materialsCollection.createIndex({ projectId: 1, status: 1 }, { name: 'project_status_idx' });
    await materialsCollection.createIndex({ purchaseDate: -1 }, { name: 'purchaseDate_desc' });
    await materialsCollection.createIndex({ category: 1 }, { name: 'category_idx' });
    await materialsCollection.createIndex({ 'quantity.received': 1 }, { name: 'quantity_received_idx' });
    await materialsCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    // Dual Workflow: New indexes for entry type and workflow tracking
    await materialsCollection.createIndex({ entryType: 1 }, { name: 'entryType_idx' });
    await materialsCollection.createIndex({ purchaseOrderId: 1 }, { name: 'purchaseOrderId_idx', sparse: true });
    await materialsCollection.createIndex({ materialRequestId: 1 }, { name: 'materialRequestId_idx', sparse: true });
    await materialsCollection.createIndex({ costStatus: 1 }, { name: 'costStatus_idx', sparse: true });
    console.log('✅ Materials collection ready\n');
    
    // ============================================
    // 3a. MATERIAL_REQUESTS COLLECTION (Dual Workflow)
    // ============================================
    console.log('📝 Setting up material_requests collection...');
    const materialRequestsCollection = db.collection('material_requests');
    
    await materialRequestsCollection.createIndex({ requestNumber: 1 }, { unique: true, name: 'requestNumber_unique' });
    await materialRequestsCollection.createIndex({ requestedBy: 1, status: 1 }, { name: 'requestedBy_status_idx' });
    await materialRequestsCollection.createIndex({ projectId: 1, status: 1 }, { name: 'project_status_idx' });
    await materialRequestsCollection.createIndex({ status: 1, createdAt: -1 }, { name: 'status_createdAt_desc' });
    await materialRequestsCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    await materialRequestsCollection.createIndex({ linkedPurchaseOrderId: 1 }, { name: 'linkedPurchaseOrderId_idx', sparse: true });
    console.log('✅ Material requests collection ready\n');
    
    // ============================================
    // 3b. PURCHASE_ORDERS COLLECTION (Dual Workflow)
    // ============================================
    console.log('📝 Setting up purchase_orders collection...');
    const purchaseOrdersCollection = db.collection('purchase_orders');
    
    await purchaseOrdersCollection.createIndex({ purchaseOrderNumber: 1 }, { unique: true, name: 'purchaseOrderNumber_unique' });
    await purchaseOrdersCollection.createIndex({ supplierId: 1, status: 1 }, { name: 'supplierId_status_idx' });
    await purchaseOrdersCollection.createIndex({ materialRequestId: 1 }, { name: 'materialRequestId_idx' });
    await purchaseOrdersCollection.createIndex({ projectId: 1, status: 1 }, { name: 'project_status_idx' });
    await purchaseOrdersCollection.createIndex({ status: 1, sentAt: -1 }, { name: 'status_sentAt_desc' });
    await purchaseOrdersCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    await purchaseOrdersCollection.createIndex({ linkedMaterialId: 1 }, { name: 'linkedMaterialId_idx', sparse: true });
    console.log('✅ Purchase orders collection ready\n');
    
    // ============================================
    // 4. EXPENSES COLLECTION
    // ============================================
    console.log('📝 Setting up expenses collection...');
    const expensesCollection = db.collection('expenses');
    
    await expensesCollection.createIndex({ projectId: 1, expenseCode: 1 }, { unique: true, name: 'project_expenseCode_unique' });
    await expensesCollection.createIndex({ projectId: 1, status: 1 }, { name: 'project_status_idx' });
    await expensesCollection.createIndex({ date: -1 }, { name: 'date_desc' });
    await expensesCollection.createIndex({ submittedBy: 1 }, { name: 'submittedBy_idx' });
    await expensesCollection.createIndex({ amount: 1 }, { name: 'amount_idx' });
    await expensesCollection.createIndex({ category: 1 }, { name: 'category_idx' });
    console.log('✅ Expenses collection ready\n');
    
    // ============================================
    // 4a. INITIAL EXPENSES COLLECTION (Module 1)
    // ============================================
    console.log('📝 Setting up initial_expenses collection...');
    const initialExpensesCollection = db.collection('initial_expenses');
    
    await initialExpensesCollection.createIndex({ projectId: 1, createdAt: -1 }, { name: 'project_createdAt_desc' });
    await initialExpensesCollection.createIndex({ expenseCode: 1 }, { unique: true, name: 'expenseCode_unique' });
    await initialExpensesCollection.createIndex({ category: 1 }, { name: 'category_idx' });
    await initialExpensesCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    await initialExpensesCollection.createIndex({ datePaid: -1 }, { name: 'datePaid_desc' });
    await initialExpensesCollection.createIndex({ amount: 1 }, { name: 'amount_idx' });
    console.log('✅ Initial expenses collection ready\n');
    
    // ============================================
    // 4b. INVESTORS COLLECTION (Module 2)
    // ============================================
    console.log('📝 Setting up investors collection...');
    const investorsCollection = db.collection('investors');
    
    await investorsCollection.createIndex({ email: 1 }, { name: 'email_idx' });
    await investorsCollection.createIndex({ userId: 1 }, { name: 'userId_idx', sparse: true }); // Sparse index since existing records may not have userId
    await investorsCollection.createIndex({ investmentType: 1 }, { name: 'investmentType_idx' });
    await investorsCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    await investorsCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    await investorsCollection.createIndex({ 'projectAllocations.projectId': 1 }, { name: 'projectAllocations_projectId_idx', sparse: true }); // Index for project allocations
    console.log('✅ Investors collection ready\n');
    
    // ============================================
    // 4c. PROJECT_FINANCES COLLECTION (Module 2)
    // ============================================
    console.log('📝 Setting up project_finances collection...');
    const projectFinancesCollection = db.collection('project_finances');
    
    await projectFinancesCollection.createIndex({ projectId: 1 }, { unique: true, name: 'projectId_unique' });
    await projectFinancesCollection.createIndex({ lastUpdated: -1 }, { name: 'lastUpdated_desc' });
    console.log('✅ Project finances collection ready\n');
    
    // ============================================
    // 5. LABOUR COLLECTION
    // ============================================
    console.log('📝 Setting up labour collection...');
    const labourCollection = db.collection('labour');
    
    await labourCollection.createIndex({ projectId: 1, employeeId: 1, date: 1 }, { name: 'project_employee_date_idx' });
    await labourCollection.createIndex({ projectId: 1, status: 1 }, { name: 'project_status_idx' });
    await labourCollection.createIndex({ date: -1 }, { name: 'date_desc' });
    await labourCollection.createIndex({ supervisorId: 1 }, { name: 'supervisorId_idx' });
    await labourCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    console.log('✅ Labour collection ready\n');
    
    // ============================================
    // 6. APPROVALS COLLECTION
    // ============================================
    console.log('📝 Setting up approvals collection...');
    const approvalsCollection = db.collection('approvals');
    
    await approvalsCollection.createIndex({ relatedId: 1, relatedModel: 1 }, { unique: true, name: 'related_unique' });
    await approvalsCollection.createIndex({ projectId: 1, status: 1 }, { name: 'project_status_idx' });
    await approvalsCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    await approvalsCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    console.log('✅ Approvals collection ready\n');
    
    // ============================================
    // 7. AUDIT_LOGS COLLECTION
    // ============================================
    console.log('📝 Setting up audit_logs collection...');
    const auditLogsCollection = db.collection('audit_logs');
    
    await auditLogsCollection.createIndex({ userId: 1, timestamp: -1 }, { name: 'userId_timestamp_desc' });
    await auditLogsCollection.createIndex({ resourceType: 1, resourceId: 1 }, { name: 'resource_idx' });
    await auditLogsCollection.createIndex({ projectId: 1, timestamp: -1 }, { name: 'project_timestamp_desc' });
    await auditLogsCollection.createIndex({ action: 1 }, { name: 'action_idx' });
    await auditLogsCollection.createIndex({ timestamp: -1 }, { name: 'timestamp_desc' }); // For retention policies
    console.log('✅ Audit logs collection ready\n');
    
    // ============================================
    // 8. NOTIFICATIONS COLLECTION
    // ============================================
    console.log('📝 Setting up notifications collection...');
    const notificationsCollection = db.collection('notifications');
    
    await notificationsCollection.createIndex({ userId: 1, isRead: 1, createdAt: -1 }, { name: 'user_read_created_idx' });
    await notificationsCollection.createIndex({ projectId: 1, createdAt: -1 }, { name: 'project_created_idx' });
    await notificationsCollection.createIndex({ isRead: 1 }, { name: 'isRead_idx' });
    console.log('✅ Notifications collection ready\n');
    
    // ============================================
    // 9. PROJECT_TEAMS COLLECTION
    // ============================================
    console.log('📝 Setting up project_teams collection...');
    const projectTeamsCollection = db.collection('project_teams');
    
    await projectTeamsCollection.createIndex({ projectId: 1, userId: 1 }, { unique: true, name: 'project_user_unique' });
    await projectTeamsCollection.createIndex({ projectId: 1, status: 1 }, { name: 'project_status_idx' });
    await projectTeamsCollection.createIndex({ userId: 1 }, { name: 'userId_idx' });
    console.log('✅ Project teams collection ready\n');
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log('📊 Database Setup Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const collections = await db.listCollections().toArray();
    console.log(`✅ Total collections: ${collections.length}`);
    collections.forEach(col => {
      console.log(`   • ${col.name}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    console.log('\n✅ Setup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Setup script failed:', error);
    process.exit(1);
  });


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
    
    await categoriesCollection.createIndex({ name: 1, type: 1 }, { unique: true, name: 'name_type_unique' });
    await categoriesCollection.createIndex({ type: 1, name: 1 }, { name: 'type_name_idx' });
    await categoriesCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    console.log('✅ Categories collection ready\n');

    // ============================================
    // 2b. FLOORS COLLECTION (Phase 2)
    // ============================================
    console.log('📝 Setting up floors collection...');
    const floorsCollection = db.collection('floors');
    
    await floorsCollection.createIndex(
      { projectId: 1, floorNumber: 1 },
      { unique: true, name: 'project_floorNumber_unique' }
    );
    await floorsCollection.createIndex({ projectId: 1 }, { name: 'projectId_idx' });
    await floorsCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    await floorsCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    console.log('✅ Floors collection ready\n');
    
    // ============================================
    // 2c. PHASES COLLECTION (Enhanced Budget/Phase System)
    // ============================================
    console.log('📝 Setting up phases collection...');
    const phasesCollection = db.collection('phases');
    
    await phasesCollection.createIndex({ projectId: 1 }, { name: 'projectId_idx' });
    await phasesCollection.createIndex({ projectId: 1, sequence: 1 }, { name: 'projectId_sequence_idx' });
    await phasesCollection.createIndex({ projectId: 1, status: 1 }, { name: 'projectId_status_idx' });
    await phasesCollection.createIndex({ phaseCode: 1 }, { name: 'phaseCode_idx' });
    await phasesCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    await phasesCollection.createIndex({ deletedAt: 1 }, { name: 'deletedAt_idx' });
    // Phase 2: Dependencies indexes
    await phasesCollection.createIndex({ dependsOn: 1 }, { name: 'dependsOn_idx', sparse: true });
    await phasesCollection.createIndex({ canStartAfter: 1 }, { name: 'canStartAfter_idx', sparse: true });
    console.log('✅ Phases collection ready\n');
    
    // ============================================
    // EQUIPMENT COLLECTION (Phase 4)
    // ============================================
    console.log('📝 Setting up equipment collection...');
    const equipmentCollection = db.collection('equipment');
    
    await equipmentCollection.createIndex(
      { projectId: 1, phaseId: 1 },
      { name: 'projectId_phaseId_idx' }
    );
    await equipmentCollection.createIndex(
      { phaseId: 1, status: 1 },
      { name: 'phaseId_status_idx' }
    );
    await equipmentCollection.createIndex(
      { projectId: 1, status: 1 },
      { name: 'projectId_status_idx' }
    );
    await equipmentCollection.createIndex(
      { supplierId: 1 },
      { name: 'supplierId_idx', sparse: true }
    );
    await equipmentCollection.createIndex(
      { equipmentType: 1 },
      { name: 'equipmentType_idx' }
    );
    await equipmentCollection.createIndex(
      { createdAt: -1 },
      { name: 'createdAt_desc' }
    );
    await equipmentCollection.createIndex(
      { deletedAt: 1 },
      { name: 'deletedAt_idx' }
    );
    console.log('✅ Equipment collection ready\n');
    
    // ============================================
    // SUBCONTRACTORS COLLECTION (Phase 5)
    // ============================================
    console.log('📝 Setting up subcontractors collection...');
    const subcontractorsCollection = db.collection('subcontractors');
    
    await subcontractorsCollection.createIndex(
      { projectId: 1, phaseId: 1 },
      { name: 'projectId_phaseId_idx' }
    );
    await subcontractorsCollection.createIndex(
      { phaseId: 1, status: 1 },
      { name: 'phaseId_status_idx' }
    );
    await subcontractorsCollection.createIndex(
      { projectId: 1, status: 1 },
      { name: 'projectId_status_idx' }
    );
    await subcontractorsCollection.createIndex(
      { subcontractorType: 1 },
      { name: 'subcontractorType_idx' }
    );
    await subcontractorsCollection.createIndex(
      { createdAt: -1 },
      { name: 'createdAt_desc' }
    );
    await subcontractorsCollection.createIndex(
      { deletedAt: 1 },
      { name: 'deletedAt_idx' }
    );
    console.log('✅ Subcontractors collection ready\n');
    
    // ============================================
    // WORK ITEMS COLLECTION (Phase 6)
    // ============================================
    console.log('📝 Setting up work_items collection...');
    const workItemsCollection = db.collection('work_items');
    
    await workItemsCollection.createIndex(
      { phaseId: 1, status: 1 },
      { name: 'phaseId_status_idx' }
    );
    await workItemsCollection.createIndex(
      { projectId: 1, phaseId: 1 },
      { name: 'projectId_phaseId_idx' }
    );
    await workItemsCollection.createIndex(
      { assignedTo: 1 },
      { name: 'assignedTo_idx', sparse: true }
    );
    await workItemsCollection.createIndex(
      { dependencies: 1 },
      { name: 'dependencies_idx' }
    );
    await workItemsCollection.createIndex(
      { category: 1 },
      { name: 'category_idx' }
    );
    await workItemsCollection.createIndex(
      { priority: 1 },
      { name: 'priority_idx' }
    );
    await workItemsCollection.createIndex(
      { createdAt: -1 },
      { name: 'createdAt_desc' }
    );
    await workItemsCollection.createIndex(
      { deletedAt: 1 },
      { name: 'deletedAt_idx' }
    );
    console.log('✅ Work items collection ready\n');
    
    // ============================================
    // PHASE TEMPLATES COLLECTION
    // ============================================
    console.log('📝 Setting up phase_templates collection...');
    const phaseTemplatesCollection = db.collection('phase_templates');
    
    await phaseTemplatesCollection.createIndex(
      { templateName: 1 },
      { name: 'templateName_idx' }
    );
    await phaseTemplatesCollection.createIndex(
      { templateType: 1 },
      { name: 'templateType_idx' }
    );
    await phaseTemplatesCollection.createIndex(
      { createdBy: 1 },
      { name: 'createdBy_idx' }
    );
    await phaseTemplatesCollection.createIndex(
      { usageCount: -1 },
      { name: 'usageCount_desc' }
    );
    await phaseTemplatesCollection.createIndex(
      { lastUsedAt: -1 },
      { name: 'lastUsedAt_desc' }
    );
    await phaseTemplatesCollection.createIndex(
      { createdAt: -1 },
      { name: 'createdAt_desc' }
    );
    await phaseTemplatesCollection.createIndex(
      { deletedAt: 1 },
      { name: 'deletedAt_idx' }
    );
    console.log('✅ Phase templates collection ready\n');
    
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
    // Bulk request indexes
    await materialRequestsCollection.createIndex({ batchId: 1, status: 1 }, { name: 'batchId_status_idx', sparse: true });
    await materialRequestsCollection.createIndex({ batchNumber: 1 }, { name: 'batchNumber_idx', sparse: true });
    await materialRequestsCollection.createIndex({ libraryMaterialId: 1 }, { name: 'libraryMaterialId_idx', sparse: true });
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
    // New indexes for token-based responses and communication tracking
    await purchaseOrdersCollection.createIndex({ responseToken: 1 }, { sparse: true, name: 'responseToken_idx' });
    await purchaseOrdersCollection.createIndex({ 'communications.sentAt': -1 }, { name: 'communications_sentAt_desc' });
    await purchaseOrdersCollection.createIndex({ autoConfirmed: 1 }, { name: 'autoConfirmed_idx' });
    // Bulk order indexes
    await purchaseOrdersCollection.createIndex({ isBulkOrder: 1, supplierId: 1, status: 1 }, { name: 'bulkOrder_supplier_status_idx', sparse: true });
    await purchaseOrdersCollection.createIndex({ batchId: 1 }, { name: 'batchId_idx', sparse: true });
    await purchaseOrdersCollection.createIndex({ materialRequestIds: 1 }, { name: 'materialRequestIds_idx', sparse: true });
    // Phase Management: Add phaseId indexes
    await purchaseOrdersCollection.createIndex(
      { phaseId: 1, projectId: 1 },
      { name: 'phaseId_projectId_idx', sparse: true }
    );
    await purchaseOrdersCollection.createIndex(
      { phaseId: 1, status: 1 },
      { name: 'phaseId_status_idx', sparse: true }
    );
    console.log('✅ Purchase orders collection ready\n');
    
    // ============================================
    // 3c. SUPPLIERS COLLECTION (Supplier Restructuring)
    // ============================================
    console.log('📝 Setting up suppliers collection...');
    const suppliersCollection = db.collection('suppliers');
    
    // Unique email index
    await suppliersCollection.createIndex({ email: 1 }, { unique: true, name: 'email_unique' });
    // Search and filtering indexes
    await suppliersCollection.createIndex({ name: 1 }, { name: 'name_text' });
    await suppliersCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    await suppliersCollection.createIndex({ specialties: 1 }, { name: 'specialties_idx' });
    await suppliersCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    await suppliersCollection.createIndex({ deletedAt: 1 }, { sparse: true, name: 'deletedAt_idx' });
    // Push notification subscription index
    await suppliersCollection.createIndex({ 'pushSubscription.endpoint': 1 }, { sparse: true, name: 'pushEndpoint_idx' });
    console.log('✅ Suppliers collection ready\n');
    
    // ============================================
    // 3d. PUSH_SUBSCRIPTIONS COLLECTION (Push Notifications)
    // ============================================
    console.log('📝 Setting up push_subscriptions collection...');
    const pushSubscriptionsCollection = db.collection('push_subscriptions');
    
    // Unique endpoint index
    await pushSubscriptionsCollection.createIndex({ endpoint: 1 }, { unique: true, name: 'endpoint_unique' });
    // User/Supplier lookups
    await pushSubscriptionsCollection.createIndex({ userId: 1 }, { name: 'userId_idx' });
    await pushSubscriptionsCollection.createIndex({ supplierId: 1 }, { sparse: true, name: 'supplierId_idx' });
    await pushSubscriptionsCollection.createIndex({ userType: 1, userId: 1 }, { name: 'userType_userId_idx' });
    await pushSubscriptionsCollection.createIndex({ userType: 1, supplierId: 1 }, { sparse: true, name: 'userType_supplierId_idx' });
    // Status and expiration
    await pushSubscriptionsCollection.createIndex({ status: 1 }, { name: 'status_idx' });
    await pushSubscriptionsCollection.createIndex({ expiresAt: 1 }, { name: 'expiresAt_idx' });
    await pushSubscriptionsCollection.createIndex({ lastActiveAt: -1 }, { name: 'lastActiveAt_desc' });
    console.log('✅ Push subscriptions collection ready\n');
    
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
    // 10. INVITATIONS COLLECTION
    // ============================================
    console.log('📝 Setting up invitations collection...');
    const invitationsCollection = db.collection('invitations');
    
    await invitationsCollection.createIndex({ email: 1, status: 1 }, { name: 'email_status_idx' });
    await invitationsCollection.createIndex({ token: 1 }, { unique: true, name: 'token_unique', sparse: true });
    await invitationsCollection.createIndex({ status: 1, expiresAt: 1 }, { name: 'status_expiresAt_idx' });
    await invitationsCollection.createIndex({ invitedBy: 1 }, { name: 'invitedBy_idx' });
    await invitationsCollection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
    await invitationsCollection.createIndex({ expiresAt: 1 }, { name: 'expiresAt_idx' });
    console.log('✅ Invitations collection ready\n');
    
    // ============================================
    // 11. ROLE_CHANGES COLLECTION
    // ============================================
    console.log('📝 Setting up role_changes collection...');
    const roleChangesCollection = db.collection('role_changes');
    
    await roleChangesCollection.createIndex({ userId: 1, timestamp: -1 }, { name: 'userId_timestamp_desc' });
    await roleChangesCollection.createIndex({ changedBy: 1 }, { name: 'changedBy_idx' });
    await roleChangesCollection.createIndex({ timestamp: -1 }, { name: 'timestamp_desc' });
    await roleChangesCollection.createIndex({ newRole: 1 }, { name: 'newRole_idx' });
    console.log('✅ Role changes collection ready\n');
    
    // ============================================
    // 12. MATERIAL_LIBRARY COLLECTION (Bulk Procurement)
    // ============================================
    console.log('📝 Setting up material_library collection...');
    const materialLibraryCollection = db.collection('material_library');
    
    await materialLibraryCollection.createIndex(
      { categoryId: 1, name: 1 },
      { unique: false, name: 'category_name_idx' }
    );
    await materialLibraryCollection.createIndex(
      { isCommon: 1, isActive: 1, usageCount: -1 },
      { name: 'common_active_usage_idx' }
    );
    await materialLibraryCollection.createIndex(
      { name: 'text', description: 'text' },
      { name: 'text_search_idx' }
    );
    await materialLibraryCollection.createIndex(
      { categoryId: 1, isActive: 1 },
      { name: 'category_active_idx' }
    );
    await materialLibraryCollection.createIndex(
      { createdAt: -1 },
      { name: 'createdAt_desc_idx' }
    );
    await materialLibraryCollection.createIndex(
      { deletedAt: 1 },
      { sparse: true, name: 'deletedAt_idx' }
    );
    console.log('✅ Material library collection ready\n');
    
    // ============================================
    // 13. MATERIAL_REQUEST_BATCHES COLLECTION (Bulk Procurement)
    // ============================================
    console.log('📝 Setting up material_request_batches collection...');
    const batchesCollection = db.collection('material_request_batches');
    
    await batchesCollection.createIndex(
      { batchNumber: 1 },
      { unique: true, name: 'batchNumber_unique_idx' }
    );
    await batchesCollection.createIndex(
      { projectId: 1, createdAt: -1 },
      { name: 'project_createdAt_idx' }
    );
    await batchesCollection.createIndex(
      { status: 1, createdAt: -1 },
      { name: 'status_createdAt_idx' }
    );
    await batchesCollection.createIndex(
      { createdBy: 1, createdAt: -1 },
      { name: 'createdBy_createdAt_idx' }
    );
    await batchesCollection.createIndex(
      { deletedAt: 1 },
      { sparse: true, name: 'deletedAt_idx' }
    );
    // Performance indexes for batch operations
    await batchesCollection.createIndex(
      { materialRequestIds: 1 },
      { name: 'materialRequestIds_idx' }
    );
    await batchesCollection.createIndex(
      { approvedBy: 1, approvedAt: -1 },
      { sparse: true, name: 'approvedBy_approvedAt_idx' }
    );
    console.log('✅ Material request batches collection ready\n');
    
    // ============================================
    // 14. MATERIAL_TEMPLATES COLLECTION (Bulk Procurement)
    // ============================================
    console.log('📝 Setting up material_templates collection...');
    const templatesCollection = db.collection('material_templates');
    
    await templatesCollection.createIndex(
      { name: 1, createdBy: 1 },
      { unique: false, name: 'name_createdBy_idx' }
    );
    await templatesCollection.createIndex(
      { createdBy: 1, createdAt: -1 },
      { name: 'createdBy_createdAt_idx' }
    );
    await templatesCollection.createIndex(
      { isPublic: 1, usageCount: -1 },
      { name: 'public_usage_idx' }
    );
    await templatesCollection.createIndex(
      { deletedAt: 1 },
      { sparse: true, name: 'deletedAt_idx' }
    );
    console.log('✅ Material templates collection ready\n');
    
    // ============================================
    // 15. BUDGET_REALLOCATIONS COLLECTION (Phase 5)
    // ============================================
    console.log('📝 Setting up budget_reallocations collection...');
    const budgetReallocationsCollection = db.collection('budget_reallocations');
    
    await budgetReallocationsCollection.createIndex(
      { projectId: 1, requestedAt: -1 },
      { name: 'projectId_requestedAt_idx' }
    );
    await budgetReallocationsCollection.createIndex(
      { fromPhaseId: 1 },
      { sparse: true, name: 'fromPhaseId_idx' }
    );
    await budgetReallocationsCollection.createIndex(
      { toPhaseId: 1 },
      { sparse: true, name: 'toPhaseId_idx' }
    );
    await budgetReallocationsCollection.createIndex(
      { status: 1, requestedAt: -1 },
      { name: 'status_requestedAt_idx' }
    );
    await budgetReallocationsCollection.createIndex(
      { requestedBy: 1, requestedAt: -1 },
      { name: 'requestedBy_requestedAt_idx' }
    );
    await budgetReallocationsCollection.createIndex(
      { deletedAt: 1 },
      { sparse: true, name: 'deletedAt_idx' }
    );
    console.log('✅ Budget reallocations collection ready\n');
    
    // ============================================
    // LABOUR ENTRIES COLLECTION (Labour System)
    // ============================================
    console.log('📝 Setting up labour_entries collection...');
    const labourEntriesCollection = db.collection('labour_entries');
    
    await labourEntriesCollection.createIndex(
      { batchId: 1, entryDate: -1 },
      { name: 'batchId_entryDate_idx', sparse: true }
    );
    await labourEntriesCollection.createIndex(
      { projectId: 1, entryDate: -1 },
      { name: 'projectId_entryDate_idx' }
    );
    await labourEntriesCollection.createIndex(
      { phaseId: 1, entryDate: -1 },
      { name: 'phaseId_entryDate_idx' }
    );
    await labourEntriesCollection.createIndex(
      { workerId: 1, entryDate: -1 },
      { name: 'workerId_entryDate_idx', sparse: true }
    );
    await labourEntriesCollection.createIndex(
      { floorId: 1 },
      { name: 'floorId_idx', sparse: true }
    );
    await labourEntriesCollection.createIndex(
      { categoryId: 1 },
      { name: 'categoryId_idx', sparse: true }
    );
    await labourEntriesCollection.createIndex(
      { workItemId: 1 },
      { name: 'workItemId_idx', sparse: true }
    );
    await labourEntriesCollection.createIndex(
      { workerType: 1, workerRole: 1 },
      { name: 'workerType_workerRole_idx' }
    );
    await labourEntriesCollection.createIndex(
      { skillType: 1 },
      { name: 'skillType_idx' }
    );
    await labourEntriesCollection.createIndex(
      { status: 1 },
      { name: 'status_idx' }
    );
    await labourEntriesCollection.createIndex(
      { entryDate: -1 },
      { name: 'entryDate_desc' }
    );
    await labourEntriesCollection.createIndex(
      { createdAt: -1 },
      { name: 'createdAt_desc' }
    );
    await labourEntriesCollection.createIndex(
      { deletedAt: 1 },
      { name: 'deletedAt_idx', sparse: true }
    );
    console.log('✅ Labour entries collection ready\n');
    
    // ============================================
    // LABOUR BATCHES COLLECTION (Labour System)
    // ============================================
    console.log('📝 Setting up labour_batches collection...');
    const labourBatchesCollection = db.collection('labour_batches');
    
    await labourBatchesCollection.createIndex(
      { batchNumber: 1 },
      { unique: true, name: 'batchNumber_unique' }
    );
    await labourBatchesCollection.createIndex(
      { projectId: 1, createdAt: -1 },
      { name: 'projectId_createdAt_idx' }
    );
    await labourBatchesCollection.createIndex(
      { status: 1 },
      { name: 'status_idx' }
    );
    await labourBatchesCollection.createIndex(
      { createdBy: 1, createdAt: -1 },
      { name: 'createdBy_createdAt_idx' }
    );
    await labourBatchesCollection.createIndex(
      { approvedBy: 1 },
      { name: 'approvedBy_idx', sparse: true }
    );
    await labourBatchesCollection.createIndex(
      { deletedAt: 1 },
      { name: 'deletedAt_idx', sparse: true }
    );
    console.log('✅ Labour batches collection ready\n');
    
    // ============================================
    // WORKER PROFILES COLLECTION (Labour System)
    // ============================================
    console.log('📝 Setting up worker_profiles collection...');
    const workerProfilesCollection = db.collection('worker_profiles');
    
    await workerProfilesCollection.createIndex(
      { employeeId: 1 },
      { unique: true, name: 'employeeId_unique' }
    );
    await workerProfilesCollection.createIndex(
      { userId: 1 },
      { unique: true, name: 'userId_unique', sparse: true }
    );
    await workerProfilesCollection.createIndex(
      { nationalId: 1 },
      { name: 'nationalId_idx', sparse: true }
    );
    await workerProfilesCollection.createIndex(
      { workerType: 1, profession: 1 },
      { name: 'workerType_profession_idx', sparse: true }
    );
    await workerProfilesCollection.createIndex(
      { skillTypes: 1 },
      { name: 'skillTypes_idx' }
    );
    await workerProfilesCollection.createIndex(
      { status: 1 },
      { name: 'status_idx' }
    );
    await workerProfilesCollection.createIndex(
      { workerName: 1 },
      { name: 'workerName_idx' }
    );
    await workerProfilesCollection.createIndex(
      { createdAt: -1 },
      { name: 'createdAt_desc' }
    );
    console.log('✅ Worker profiles collection ready\n');
    
    // ============================================
    // LABOUR COST SUMMARIES COLLECTION (Labour System)
    // ============================================
    console.log('📝 Setting up labour_cost_summaries collection...');
    const labourCostSummariesCollection = db.collection('labour_cost_summaries');
    
    await labourCostSummariesCollection.createIndex(
      { projectId: 1, periodStart: -1 },
      { name: 'projectId_periodStart_idx' }
    );
    await labourCostSummariesCollection.createIndex(
      { phaseId: 1, periodStart: -1 },
      { name: 'phaseId_periodStart_idx', sparse: true }
    );
    await labourCostSummariesCollection.createIndex(
      { periodType: 1, periodStart: -1 },
      { name: 'periodType_periodStart_idx' }
    );
    await labourCostSummariesCollection.createIndex(
      { floorId: 1 },
      { name: 'floorId_idx', sparse: true }
    );
    await labourCostSummariesCollection.createIndex(
      { categoryId: 1 },
      { name: 'categoryId_idx', sparse: true }
    );
    console.log('✅ Labour cost summaries collection ready\n');
    
    // ============================================
    // LABOUR TEMPLATES COLLECTION (Labour System)
    // ============================================
    console.log('📝 Setting up labour_templates collection...');
    const labourTemplatesCollection = db.collection('labour_templates');
    
    await labourTemplatesCollection.createIndex(
      { name: 1 },
      { name: 'name_idx' }
    );
    await labourTemplatesCollection.createIndex(
      { createdBy: 1, createdAt: -1 },
      { name: 'createdBy_createdAt_idx' }
    );
    await labourTemplatesCollection.createIndex(
      { isPublic: 1, status: 1 },
      { name: 'isPublic_status_idx' }
    );
    await labourTemplatesCollection.createIndex(
      { templateCategory: 1, templateType: 1 },
      { name: 'templateCategory_templateType_idx', sparse: true }
    );
    await labourTemplatesCollection.createIndex(
      { tags: 1 },
      { name: 'tags_idx' }
    );
    await labourTemplatesCollection.createIndex(
      { usageCount: -1 },
      { name: 'usageCount_desc' }
    );
    await labourTemplatesCollection.createIndex(
      { lastUsedAt: -1 },
      { name: 'lastUsedAt_desc', sparse: true }
    );
    await labourTemplatesCollection.createIndex(
      { deletedAt: 1 },
      { name: 'deletedAt_idx', sparse: true }
    );
    console.log('✅ Labour templates collection ready\n');
    
    // ============================================
    // SUPERVISOR SUBMISSIONS COLLECTION (Labour System)
    // ============================================
    console.log('📝 Setting up supervisor_submissions collection...');
    const supervisorSubmissionsCollection = db.collection('supervisor_submissions');
    
    await supervisorSubmissionsCollection.createIndex(
      { submissionNumber: 1 },
      { unique: true, name: 'submissionNumber_unique' }
    );
    await supervisorSubmissionsCollection.createIndex(
      { projectId: 1, submittedAt: -1 },
      { name: 'projectId_submittedAt_idx' }
    );
    await supervisorSubmissionsCollection.createIndex(
      { phaseId: 1, submittedAt: -1 },
      { name: 'phaseId_submittedAt_idx' }
    );
    await supervisorSubmissionsCollection.createIndex(
      { status: 1, submittedAt: -1 },
      { name: 'status_submittedAt_idx' }
    );
    await supervisorSubmissionsCollection.createIndex(
      { submissionChannel: 1 },
      { name: 'submissionChannel_idx' }
    );
    await supervisorSubmissionsCollection.createIndex(
      { submittedBy: 1 },
      { name: 'submittedBy_idx' }
    );
    await supervisorSubmissionsCollection.createIndex(
      { reviewedBy: 1 },
      { name: 'reviewedBy_idx', sparse: true }
    );
    await supervisorSubmissionsCollection.createIndex(
      { labourBatchId: 1 },
      { name: 'labourBatchId_idx', sparse: true }
    );
    console.log('✅ Supervisor submissions collection ready\n');
    
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


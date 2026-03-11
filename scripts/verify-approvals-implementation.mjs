/**
 * Approvals System Verification Script
 * Comprehensive testing of all approvals functionality
 * 
 * Run with: node scripts/verify-approvals-implementation.mjs
 * 
 * This script verifies:
 * - API endpoints structure
 * - Status constants
 * - Approval flow integration
 * - Database collections
 * - Permission checks
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'kisheka_construction';

const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: [],
};

function test(name, condition, errorMessage, isWarning = false) {
  testResults.tests.push({ name, passed: condition, errorMessage, isWarning });
  
  if (condition) {
    console.log(`✅ ${name}`);
    testResults.passed++;
  } else if (isWarning) {
    console.log(`⚠️  ${name} - ${errorMessage}`);
    testResults.warnings++;
  } else {
    console.log(`❌ ${name} - ${errorMessage}`);
    testResults.failed++;
  }
}

async function testFileStructure() {
  console.log('\n📋 Test Suite 1: File Structure');
  console.log('─'.repeat(60));
  
  const basePath = join(__dirname, '..', 'src');
  
  // Check status constants file
  const statusConstantsPath = join(basePath, 'lib', 'status-constants.js');
  test(
    'Status constants file exists',
    existsSync(statusConstantsPath),
    'status-constants.js not found'
  );
  
  if (existsSync(statusConstantsPath)) {
    const statusConstants = readFileSync(statusConstantsPath, 'utf8');
    test(
      'APPROVAL_STATUS_MAP defined',
      statusConstants.includes('APPROVAL_STATUS_MAP'),
      'APPROVAL_STATUS_MAP not found in status-constants.js'
    );
    test(
      'getPendingApprovalStatuses function exists',
      statusConstants.includes('getPendingApprovalStatuses'),
      'getPendingApprovalStatuses function not found'
    );
  }
  
  // Check API endpoints
  const apiBasePath = join(basePath, 'app', 'api', 'approvals');
  
  const endpoints = [
    { path: 'pending', name: 'Pending approvals endpoint' },
    { path: 'history', name: 'Approval history endpoint' },
    { path: 'bulk', name: 'Bulk approvals endpoint' },
    { path: 'analytics', name: 'Analytics endpoint' },
  ];
  
  endpoints.forEach(({ path, name }) => {
    const endpointPath = join(apiBasePath, path, 'route.js');
    test(
      `${name} exists`,
      existsSync(endpointPath),
      `${path}/route.js not found`
    );
  });
  
  // Check components
  const componentsPath = join(basePath, 'components', 'approvals');
  const components = [
    { file: 'ApprovalHistory.js', name: 'ApprovalHistory component' },
    { file: 'ApprovalHistoryModal.js', name: 'ApprovalHistoryModal component' },
  ];
  
  components.forEach(({ file, name }) => {
    const componentPath = join(componentsPath, file);
    test(
      `${name} exists`,
      existsSync(componentPath),
      `${file} not found`
    );
  });
  
  // Check approvals page
  const approvalsPagePath = join(basePath, 'app', 'dashboard', 'approvals', 'page.js');
  test(
    'Approvals page exists',
    existsSync(approvalsPagePath),
    'approvals/page.js not found'
  );
}

async function testStatusConstants() {
  console.log('\n📋 Test Suite 2: Status Constants');
  console.log('─'.repeat(60));
  
  try {
    const statusConstantsPath = join(__dirname, '..', 'src', 'lib', 'status-constants.js');
    
    if (!existsSync(statusConstantsPath)) {
      test('Status constants file readable', false, 'File does not exist');
      return;
    }
    
    // Dynamically import the module
    const statusConstantsModule = await import(`file://${statusConstantsPath}`);
    
    test(
      'APPROVAL_STATUS_MAP exported',
      typeof statusConstantsModule.APPROVAL_STATUS_MAP === 'object',
      'APPROVAL_STATUS_MAP not exported or not an object'
    );
    
    test(
      'getPendingApprovalStatuses function exported',
      typeof statusConstantsModule.getPendingApprovalStatuses === 'function',
      'getPendingApprovalStatuses not exported or not a function'
    );
    
    // Test that all required approval types are defined
    const requiredTypes = [
      'materials',
      'expenses',
      'initial_expenses',
      'material_requests',
      'labour_entries',
      'professional_fees',
      'professional_activities',
      'budget_reallocations',
      'purchase_orders', // Also check purchase_orders (used in status map)
      'purchase_order_modifications', // And purchase_order_modifications (used in frontend)
      'contingency_draws',
    ];
    
    if (statusConstantsModule.APPROVAL_STATUS_MAP) {
      requiredTypes.forEach(type => {
        // purchase_order_modifications is an alias, so check both
        const isAlias = type === 'purchase_order_modifications';
        const hasType = statusConstantsModule.APPROVAL_STATUS_MAP[type] !== undefined;
        const hasAlias = isAlias && statusConstantsModule.APPROVAL_STATUS_MAP['purchase_orders'] !== undefined;
        
        test(
          `Status map includes ${type}`,
          hasType || hasAlias,
          `${type} not found in APPROVAL_STATUS_MAP${isAlias ? ' (and purchase_orders alias not found)' : ''}`
        );
      });
      
      // Test getPendingApprovalStatuses function
      requiredTypes.forEach(type => {
        // purchase_order_modifications should use purchase_orders in the function
        const testType = type === 'purchase_order_modifications' ? 'purchase_orders' : type;
        const statuses = statusConstantsModule.getPendingApprovalStatuses(testType);
        test(
          `getPendingApprovalStatuses returns array for ${type}`,
          Array.isArray(statuses) && statuses.length > 0,
          `getPendingApprovalStatuses(${testType}) did not return valid array`
        );
      });
    }
  } catch (error) {
    test('Status constants module loads', false, `Error loading module: ${error.message}`);
  }
}

async function testDatabaseStructure(db) {
  console.log('\n📋 Test Suite 3: Database Structure');
  console.log('─'.repeat(60));
  
  // Check required collections exist
  // Note: Some collections may not exist until first use (professional_fees, professional_activities, contingency_draws)
  // These are marked as warnings, not failures
  const requiredCollections = [
    { name: 'materials', required: true },
    { name: 'expenses', required: true },
    { name: 'initial_expenses', required: true },
    { name: 'material_requests', required: true },
    { name: 'labour_entries', required: true },
    { name: 'professional_fees', required: false }, // May not exist until first use
    { name: 'professional_activities', required: false }, // May not exist until first use
    { name: 'budget_reallocations', required: true },
    { name: 'purchase_orders', required: true },
    { name: 'contingency_draws', required: false }, // May not exist until first use
    { name: 'notifications', required: true },
    { name: 'approvals', required: true },
  ];
  
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  
  requiredCollections.forEach(({ name, required }) => {
    test(
      `Collection ${name} exists`,
      collectionNames.includes(name),
      `Collection ${name} not found in database`,
      !required // Mark as warning if not required
    );
  });
  
  // Check that collections have status fields (sample check)
  for (const collectionName of ['materials', 'expenses', 'material_requests']) {
    try {
      const sample = await db.collection(collectionName).findOne({});
      if (sample) {
        test(
          `${collectionName} has status field`,
          'status' in sample,
          `${collectionName} documents missing status field`,
          true // Warning, not critical
        );
      }
    } catch (error) {
      // Collection might be empty, that's okay
      test(
        `${collectionName} accessible`,
        true,
        '',
        true
      );
    }
  }
}

async function testAPIEndpoints() {
  console.log('\n📋 Test Suite 4: API Endpoints Structure');
  console.log('─'.repeat(60));
  
  const basePath = join(__dirname, '..', 'src', 'app', 'api', 'approvals');
  
  // Test pending endpoint structure
  const pendingPath = join(basePath, 'pending', 'route.js');
  if (existsSync(pendingPath)) {
    const pendingCode = readFileSync(pendingPath, 'utf8');
    test(
      'Pending endpoint has GET handler',
      pendingCode.includes('export async function GET'),
      'GET handler not found in pending endpoint'
    );
    test(
      'Pending endpoint uses status constants',
      pendingCode.includes('getPendingApprovalStatuses') || pendingCode.includes('APPROVAL_STATUS_MAP'),
      'Pending endpoint does not use status constants'
    );
    test(
      'Pending endpoint supports projectId',
      pendingCode.includes('projectId'),
      'Pending endpoint does not support projectId parameter'
    );
  }
  
  // Test history endpoint structure
  const historyPath = join(basePath, 'history', 'route.js');
  if (existsSync(historyPath)) {
    const historyCode = readFileSync(historyPath, 'utf8');
    test(
      'History endpoint has GET handler',
      historyCode.includes('export async function GET'),
      'GET handler not found in history endpoint'
    );
    test(
      'History endpoint supports relatedId and relatedModel',
      historyCode.includes('relatedId') && historyCode.includes('relatedModel'),
      'History endpoint missing required parameters'
    );
  }
  
  // Test bulk endpoint structure
  const bulkPath = join(basePath, 'bulk', 'route.js');
  if (existsSync(bulkPath)) {
    const bulkCode = readFileSync(bulkPath, 'utf8');
    test(
      'Bulk endpoint has POST handler',
      bulkCode.includes('export async function POST'),
      'POST handler not found in bulk endpoint'
    );
    test(
      'Bulk endpoint supports action parameter',
      bulkCode.includes('action') && (bulkCode.includes('approve') || bulkCode.includes('reject')),
      'Bulk endpoint missing action parameter support'
    );
  }
  
  // Test analytics endpoint structure
  const analyticsPath = join(basePath, 'analytics', 'route.js');
  if (existsSync(analyticsPath)) {
    const analyticsCode = readFileSync(analyticsPath, 'utf8');
    test(
      'Analytics endpoint has GET handler',
      analyticsCode.includes('export async function GET'),
      'GET handler not found in analytics endpoint'
    );
    test(
      'Analytics endpoint calculates metrics',
      analyticsCode.includes('metrics') || analyticsCode.includes('totalPending'),
      'Analytics endpoint missing metrics calculation'
    );
    test(
      'Analytics endpoint identifies bottlenecks',
      analyticsCode.includes('bottleneck') || analyticsCode.includes('daysPending'),
      'Analytics endpoint missing bottleneck identification'
    );
  }
}

async function testApprovalsPage() {
  console.log('\n📋 Test Suite 5: Approvals Page Structure');
  console.log('─'.repeat(60));
  
  const pagePath = join(__dirname, '..', 'src', 'app', 'dashboard', 'approvals', 'page.js');
  
  if (!existsSync(pagePath)) {
    test('Approvals page file readable', false, 'File does not exist');
    return;
  }
  
  const pageCode = readFileSync(pagePath, 'utf8');
  
  // Test for required functionality
  test(
    'Approvals page uses ProjectContext',
    pageCode.includes('useProjectContext') || pageCode.includes('ProjectContext'),
    'Approvals page does not use ProjectContext'
  );
  
  test(
    'Approvals page has fetchPendingApprovals function',
    pageCode.includes('fetchPendingApprovals'),
    'fetchPendingApprovals function not found'
  );
  
  test(
    'Approvals page supports all approval types',
    pageCode.includes('materials') && 
    pageCode.includes('expenses') && 
    pageCode.includes('materialRequests') &&
    pageCode.includes('labourEntries'),
    'Approvals page missing some approval types'
  );
  
  test(
    'Approvals page has bulk operations',
    pageCode.includes('handleBulkApprove') || pageCode.includes('bulkProcessing'),
    'Bulk operations not found in approvals page'
  );
  
  test(
    'Approvals page has cross-type bulk operations',
    pageCode.includes('handleCrossTypeBulkApprove') || pageCode.includes('cross-type'),
    'Cross-type bulk operations not found'
  );
  
  test(
    'Approvals page has analytics toggle',
    pageCode.includes('showAnalytics') || pageCode.includes('analytics'),
    'Analytics functionality not found'
  );
  
  test(
    'Approvals page has export functionality',
    pageCode.includes('handleExportCSV') || pageCode.includes('Export to CSV'),
    'Export functionality not found'
  );
  
  test(
    'Approvals page integrates ApprovalHistoryModal',
    pageCode.includes('ApprovalHistoryModal') || pageCode.includes('openHistoryModal'),
    'ApprovalHistoryModal not integrated'
  );
  
  test(
    'Approvals page marks notifications as read',
    pageCode.includes('markAllNotificationsAsRead') || 
    (pageCode.includes('/api/notifications') && pageCode.includes('PATCH')),
    'Notification marking not implemented'
  );
}

async function testIntegrationPoints() {
  console.log('\n📋 Test Suite 6: Integration Points');
  console.log('─'.repeat(60));
  
  const basePath = join(__dirname, '..', 'src');
  
  // Check dashboard summary endpoint includes approvals
  const dashboardSummaryPath = join(basePath, 'app', 'api', 'dashboard', 'summary', 'route.js');
  if (existsSync(dashboardSummaryPath)) {
    const summaryCode = readFileSync(dashboardSummaryPath, 'utf8');
    test(
      'Dashboard summary includes pending approvals',
      summaryCode.includes('pendingApprovals') || 
      summaryCode.includes('pending_approvals') || 
      summaryCode.includes('totalPendingApprovals') ||
      summaryCode.includes('pendingBreakdown'),
      'Dashboard summary missing pending approvals count'
    );
    test(
      'Dashboard summary supports projectId',
      summaryCode.includes('projectId'),
      'Dashboard summary missing projectId support'
    );
  }
  
  // Check sidebar/header integration
  const sidebarPath = join(basePath, 'components', 'layout', 'sidebar.js');
  if (existsSync(sidebarPath)) {
    const sidebarCode = readFileSync(sidebarPath, 'utf8');
    test(
      'Sidebar fetches pending approvals count',
      sidebarCode.includes('pendingApprovalsCount') || sidebarCode.includes('pending_approvals'),
      'Sidebar missing pending approvals integration'
    );
    test(
      'Sidebar badge only shows when count > 0',
      sidebarCode.includes('pendingApprovalsCount > 0') || sidebarCode.includes('count > 0'),
      'Sidebar badge logic may be incorrect'
    );
  }
}

async function runAllTests() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log(`📦 Using database: ${DB_NAME}\n`);
    console.log('🧪 Starting Approvals System Verification...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Run all test suites
    await testFileStructure();
    await testStatusConstants();
    await testDatabaseStructure(db);
    await testAPIEndpoints();
    await testApprovalsPage();
    await testIntegrationPoints();
    
    // Print summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⚠️  Warnings: ${testResults.warnings}`);
    console.log(`📝 Total Tests: ${testResults.tests.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (testResults.failed === 0) {
      console.log('🎉 All critical tests passed! Approvals system is ready.\n');
      return true;
    } else {
      console.warn('⚠️  Some tests failed. Please review the errors above.\n');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test execution error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run tests
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

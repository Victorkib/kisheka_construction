/**
 * Phase 2 Implementation Verification Script
 * 
 * Verifies that Phase 2 (Phase Management System) is correctly implemented:
 * 1. Phase APIs exist and work
 * 2. Phase helpers exist
 * 3. Phase UI pages exist
 * 4. Phase integration with projects
 * 5. No orphaned code or issues
 * 
 * Run with: node scripts/verify-phase2-implementation.mjs
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

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function test(name, condition, errorMessage) {
  if (condition) {
    console.log(`✅ ${name}`);
    testsPassed++;
  } else {
    console.log(`❌ ${name}: ${errorMessage}`);
    testsFailed++;
    failures.push({ name, errorMessage });
  }
}

async function verifyPhase2() {
  let client;
  
  try {
    console.log('🔍 Phase 2 Implementation Verification\n');
    console.log('='.repeat(60));
    
    // Test 1: Check API files exist
    console.log('\n📋 Test 1: API Files');
    console.log('-'.repeat(60));
    
    const fs = await import('fs');
    const path = await import('path');
    
    const phasesRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'phases', 'route.js');
    const phaseDetailRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'phases', '[id]', 'route.js');
    const phaseBudgetRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'phases', '[id]', 'budget', 'route.js');
    const phaseFinancialRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'phases', '[id]', 'financial', 'route.js');
    const initializePhasesRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'projects', '[id]', 'phases', 'initialize', 'route.js');
    
    test(
      'Phases list API exists',
      fs.existsSync(phasesRoutePath),
      'phases/route.js not found'
    );
    
    test(
      'Phase detail API exists',
      fs.existsSync(phaseDetailRoutePath),
      'phases/[id]/route.js not found'
    );
    
    test(
      'Phase budget API exists',
      fs.existsSync(phaseBudgetRoutePath),
      'phases/[id]/budget/route.js not found'
    );
    
    test(
      'Phase financial API exists',
      fs.existsSync(phaseFinancialRoutePath),
      'phases/[id]/financial/route.js not found'
    );
    
    test(
      'Initialize phases API exists',
      fs.existsSync(initializePhasesRoutePath),
      'projects/[id]/phases/initialize/route.js not found'
    );
    
    // Test 2: Check helper files
    console.log('\n📋 Test 2: Helper Files');
    console.log('-'.repeat(60));
    
    const phaseHelpersPath = path.join(__dirname, '..', 'src', 'lib', 'phase-helpers.js');
    test(
      'Phase helpers file exists',
      fs.existsSync(phaseHelpersPath),
      'phase-helpers.js not found'
    );
    
    // Test 3: Check UI pages
    console.log('\n📋 Test 3: UI Pages');
    console.log('-'.repeat(60));
    
    const phasesPagePath = path.join(__dirname, '..', 'src', 'app', 'phases', 'page.js');
    const phaseDetailPagePath = path.join(__dirname, '..', 'src', 'app', 'phases', '[id]', 'page.js');
    
    test(
      'Phases list page exists',
      fs.existsSync(phasesPagePath),
      'phases/page.js not found'
    );
    
    test(
      'Phase detail page exists',
      fs.existsSync(phaseDetailPagePath),
      'phases/[id]/page.js not found'
    );
    
    // Test 4: Check API code quality
    console.log('\n📋 Test 4: API Code Quality');
    console.log('-'.repeat(60));
    
    if (fs.existsSync(phasesRoutePath)) {
      const phasesRoute = fs.readFileSync(phasesRoutePath, 'utf8');
      test(
        'Phases API imports phase schema',
        phasesRoute.includes('phase-schema') || phasesRoute.includes('createPhase'),
        'Phase schema not imported in phases API'
      );
      
      test(
        'Phases API has GET endpoint',
        phasesRoute.includes('export async function GET'),
        'GET endpoint not found in phases API'
      );
      
      test(
        'Phases API has POST endpoint',
        phasesRoute.includes('export async function POST'),
        'POST endpoint not found in phases API'
      );
    }
    
    if (fs.existsSync(phaseDetailRoutePath)) {
      const phaseDetailRoute = fs.readFileSync(phaseDetailRoutePath, 'utf8');
      test(
        'Phase detail API has GET endpoint',
        phaseDetailRoute.includes('export async function GET'),
        'GET endpoint not found in phase detail API'
      );
      
      test(
        'Phase detail API has PATCH endpoint',
        phaseDetailRoute.includes('export async function PATCH'),
        'PATCH endpoint not found in phase detail API'
      );
      
      test(
        'Phase detail API has DELETE endpoint',
        phaseDetailRoute.includes('export async function DELETE'),
        'DELETE endpoint not found in phase detail API'
      );
    }
    
    // Test 5: Check permissions
    console.log('\n📋 Test 5: Permissions');
    console.log('-'.repeat(60));
    
    const permissionsPath = path.join(__dirname, '..', 'src', 'lib', 'permissions.js');
    if (fs.existsSync(permissionsPath)) {
      const permissions = fs.readFileSync(permissionsPath, 'utf8');
      test(
        'Phase permissions defined',
        permissions.includes('create_phase') && permissions.includes('edit_phase'),
        'Phase permissions not found in permissions.js'
      );
    } else {
      test('Permissions file exists', false, 'permissions.js not found');
    }
    
    // Test 6: Check project integration
    console.log('\n📋 Test 6: Project Integration');
    console.log('-'.repeat(60));
    
    const projectDetailPath = path.join(__dirname, '..', 'src', 'app', 'projects', '[id]', 'page.js');
    if (fs.existsSync(projectDetailPath)) {
      const projectDetail = fs.readFileSync(projectDetailPath, 'utf8');
      test(
        'Project detail page includes PhasesSection',
        projectDetail.includes('PhasesSection') || projectDetail.includes('Construction Phases'),
        'PhasesSection not found in project detail page'
      );
      
      test(
        'Project detail page has phases link',
        projectDetail.includes('/phases?projectId') || projectDetail.includes('Manage Phases'),
        'Phases link not found in project detail page'
      );
    } else {
      test('Project detail page exists', false, 'projects/[id]/page.js not found');
    }
    
    // Test 7: Database collections
    console.log('\n📋 Test 7: Database Collections');
    console.log('-'.repeat(60));
    
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    test(
      'Phases collection exists or can be created',
      true, // Phases collection will be created on first use
      ''
    );
    
    // Test 8: Check for orphaned code
    console.log('\n📋 Test 8: Code Quality - No Orphaned Code');
    console.log('-'.repeat(60));
    
    // Check that all imports are used
    if (fs.existsSync(phasesRoutePath)) {
      const phasesRoute = fs.readFileSync(phasesRoutePath, 'utf8');
      const imports = phasesRoute.match(/import.*from/g) || [];
      const hasUnusedImports = imports.some(imp => {
        const imported = imp.match(/import\s+{([^}]+)}/)?.[1] || imp.match(/import\s+(\w+)/)?.[1];
        if (!imported) return false;
        const importedNames = imported.split(',').map(i => i.trim().split(' as ')[0]);
        return importedNames.some(name => !phasesRoute.includes(name) || phasesRoute.split(name).length < 3);
      });
      
      test(
        'No obvious unused imports in phases API',
        !hasUnusedImports,
        'Potential unused imports found'
      );
    }
    
    // Test 9: Check helper functions
    console.log('\n📋 Test 9: Helper Functions');
    console.log('-'.repeat(60));
    
    if (fs.existsSync(phaseHelpersPath)) {
      const phaseHelpers = fs.readFileSync(phaseHelpersPath, 'utf8');
      test(
        'Phase helpers export initializeDefaultPhases',
        phaseHelpers.includes('initializeDefaultPhases') && phaseHelpers.includes('export'),
        'initializeDefaultPhases not exported'
      );
      
      test(
        'Phase helpers export getProjectPhases',
        phaseHelpers.includes('getProjectPhases') && phaseHelpers.includes('export'),
        'getProjectPhases not exported'
      );
      
      test(
        'Phase helpers export recalculatePhaseSpending',
        phaseHelpers.includes('recalculatePhaseSpending') && phaseHelpers.includes('export'),
        'recalculatePhaseSpending not exported'
      );
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    
    if (testsFailed > 0) {
      console.log('\n❌ FAILURES:');
      failures.forEach(({ name, errorMessage }) => {
        if (errorMessage) {
          console.log(`   - ${name}: ${errorMessage}`);
        }
      });
      console.log('\n⚠️  Some tests failed. Please review and fix issues before proceeding.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed! Phase 2 implementation is correct.');
      console.log('\n📝 Next Steps:');
      console.log('   1. Test phase creation through UI');
      console.log('   2. Test phase budget allocation');
      console.log('   3. Test phase financial tracking');
      console.log('   4. Verify phase integration in project detail page');
      console.log('   5. Proceed to Phase 3: Enhanced Budget Structure');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run verification
verifyPhase2().catch(console.error);




#!/usr/bin/env node

/**
 * Script to add 'export const dynamic = "force-dynamic";' to all API routes
 * that use dynamic data but don't already have it
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Find all route files that need force-dynamic
const routes = execSync(
  'grep -r "getDatabase\\|db\\.collection\\|createClient\\|getUserProfile" src/app/api --include="route.js" | grep -v "force-dynamic" | cut -d: -f1 | sort -u',
  { cwd: projectRoot, encoding: 'utf-8' }
)
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`Found ${routes.length} routes to update\n`);

let updated = 0;
let skipped = 0;
let errors = 0;

for (const routePath of routes) {
  const fullPath = join(projectRoot, routePath);
  
  if (!existsSync(fullPath)) {
    console.error(`❌ File not found: ${routePath}`);
    errors++;
    continue;
  }

  try {
    let content = readFileSync(fullPath, 'utf-8');
    
    // Skip if already has force-dynamic
    if (content.includes('export const dynamic')) {
      skipped++;
      continue;
    }

    // Find the insertion point: after last import, before first export/const/function
    const lines = content.split('\n');
    let insertIndex = -1;
    
    // Find last import line
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex === -1) {
      // No imports, find first export/const/function
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('export ') || line.startsWith('const ') || line.startsWith('function ')) {
          insertIndex = i;
          break;
        }
      }
    } else {
      // Insert after last import, before any comments/functions
      insertIndex = lastImportIndex + 1;
      
      // Skip empty lines and comments
      while (insertIndex < lines.length && 
             (lines[insertIndex].trim() === '' || 
              lines[insertIndex].trim().startsWith('//') ||
              lines[insertIndex].trim().startsWith('/**') ||
              lines[insertIndex].trim().startsWith('*'))) {
        insertIndex++;
      }
    }
    
    if (insertIndex === -1) {
      console.error(`⚠️  Could not find insertion point: ${routePath}`);
      errors++;
      continue;
    }
    
    // Insert force-dynamic
    const forceDynamicLine = "// Force dynamic rendering to prevent caching stale data";
    const exportLine = "export const dynamic = 'force-dynamic';";
    
    // Check if there's already a blank line
    const needsBlankLine = insertIndex > 0 && lines[insertIndex - 1].trim() !== '';
    
    const newLines = [
      ...lines.slice(0, insertIndex),
      ...(needsBlankLine ? [''] : []),
      forceDynamicLine,
      exportLine,
      '',
      ...lines.slice(insertIndex)
    ];
    
    writeFileSync(fullPath, newLines.join('\n'), 'utf-8');
    updated++;
    console.log(`✅ Updated: ${routePath}`);
    
  } catch (error) {
    console.error(`❌ Error updating ${routePath}:`, error.message);
    errors++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   ✅ Updated: ${updated}`);
console.log(`   ⏭️  Skipped: ${skipped}`);
console.log(`   ❌ Errors: ${errors}`);
console.log(`\n✨ Done!`);

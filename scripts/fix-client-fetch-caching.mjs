#!/usr/bin/env node

/**
 * Script to add cache: 'no-store' to client-side fetch calls
 * that fetch dynamic data (user data, profiles, dashboard data, etc.)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Patterns to match fetch calls that need no-cache
const dynamicApiPatterns = [
  '/api/profile',
  '/api/auth/me',
  '/api/dashboard',
  '/api/projects',
  '/api/users',
  '/api/notifications',
  '/api/material-requests',
  '/api/purchase-orders',
  '/api/expenses',
  '/api/materials',
  '/api/labour',
  '/api/equipment',
  '/api/suppliers',
  '/api/investors',
  '/api/financing',
  '/api/phases',
  '/api/floors',
  '/api/categories',
  '/api/work-items',
  '/api/subcontractors',
  '/api/professional-services',
  '/api/professional-fees',
  '/api/professional-activities',
  '/api/initial-expenses',
  '/api/project-finances',
  '/api/discrepancies',
  '/api/analytics',
  '/api/reports',
];

// Find all client component files with fetch calls
const files = execSync(
  "find src/app src/components src/hooks -type f -name '*.js' -o -name '*.jsx' | grep -v node_modules",
  { cwd: projectRoot, encoding: 'utf-8' }
)
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`Found ${files.length} files to check\n`);

let updated = 0;
let skipped = 0;
let errors = 0;

for (const filePath of files) {
  const fullPath = join(projectRoot, filePath);
  
  if (!existsSync(fullPath)) {
    continue;
  }

  try {
    let content = readFileSync(fullPath, 'utf-8');
    
    // Skip if not a client component or doesn't have fetch calls
    if (!content.includes("'use client'") && !content.includes('"use client"')) {
      continue;
    }
    
    if (!content.includes('fetch(')) {
      continue;
    }
    
    let modified = false;
    const lines = content.split('\n');
    const newLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is a fetch call to a dynamic API
      const isDynamicFetch = dynamicApiPatterns.some(pattern => 
        line.includes(`fetch('${pattern}`) || 
        line.includes(`fetch("${pattern}`) ||
        line.includes(`fetch(\`${pattern}`)
      );
      
      // Check if it already has cache: 'no-store'
      const hasNoCache = line.includes("cache: 'no-store'") || 
                         line.includes('cache: "no-store"') ||
                         line.includes('cache: `no-store`') ||
                         content.includes('fetchNoCache');
      
      if (isDynamicFetch && !hasNoCache) {
        // Check if it's a single-line fetch or multi-line
        if (line.includes('fetch(') && line.includes(')')) {
          // Single line fetch - need to convert to multi-line
          const fetchMatch = line.match(/fetch\((['"`])([^'"`]+)\1\)/);
          if (fetchMatch) {
            const quote = fetchMatch[1];
            const url = fetchMatch[2];
            const indent = line.match(/^(\s*)/)[1];
            
            newLines.push(`${indent}const response = await fetch(${quote}${url}${quote}, {`);
            newLines.push(`${indent}  cache: 'no-store',`);
            newLines.push(`${indent}  headers: {`);
            newLines.push(`${indent}    'Cache-Control': 'no-cache, no-store, must-revalidate',`);
            newLines.push(`${indent}    'Pragma': 'no-cache',`);
            newLines.push(`${indent}  },`);
            newLines.push(`${indent}});`);
            modified = true;
            continue;
          }
        } else if (line.includes('fetch(') && !line.includes(')')) {
          // Multi-line fetch - find the closing and add cache option
          newLines.push(line);
          
          // Look ahead to find where to insert cache option
          let j = i + 1;
          let foundClosing = false;
          let foundOptions = false;
          
          while (j < lines.length && !foundClosing) {
            if (lines[j].includes(')') || lines[j].includes(');')) {
              foundClosing = true;
              // Check if there's already an options object
              if (lines[j-1].includes('{') || lines.slice(i, j).some(l => l.includes('{'))) {
                foundOptions = true;
                // Find the last line before closing and add cache
                const lastOptionLine = j - 1;
                while (lastOptionLine > i && lines[lastOptionLine].trim() === '') {
                  j--;
                }
                // Insert cache option before closing
                const indent = lines[j-1].match(/^(\s*)/)[1];
                newLines.push(`${indent}  cache: 'no-store',`);
                newLines.push(`${indent}  headers: {`);
                newLines.push(`${indent}    'Cache-Control': 'no-cache, no-store, must-revalidate',`);
                newLines.push(`${indent}    'Pragma': 'no-cache',`);
                newLines.push(`${indent}  },`);
                i = j - 1; // Skip the lines we just processed
                modified = true;
                break;
              } else {
                // No options object, add one
                const indent = line.match(/^(\s*)/)[1];
                newLines.push(`${indent}, {`);
                newLines.push(`${indent}  cache: 'no-store',`);
                newLines.push(`${indent}  headers: {`);
                newLines.push(`${indent}    'Cache-Control': 'no-cache, no-store, must-revalidate',`);
                newLines.push(`${indent}    'Pragma': 'no-cache',`);
                newLines.push(`${indent}  },`);
                newLines.push(`${indent}}`);
                i = j - 1;
                modified = true;
                break;
              }
            }
            j++;
          }
          
          if (!foundClosing) {
            newLines.push(line);
          }
          continue;
        }
      }
      
      newLines.push(line);
    }
    
    if (modified) {
      writeFileSync(fullPath, newLines.join('\n'), 'utf-8');
      updated++;
      console.log(`✅ Updated: ${filePath}`);
    } else {
      skipped++;
    }
    
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    errors++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   ✅ Updated: ${updated}`);
console.log(`   ⏭️  Skipped: ${skipped}`);
console.log(`   ❌ Errors: ${errors}`);
console.log(`\n✨ Done!`);

/**
 * Check for Missing Handlers
 * 
 * This script checks for onClick handlers that reference undefined functions
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src', 'app');

function findJSFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findJSFiles(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function extractHandlers(content) {
  const handlers = new Set();
  
  // Find onClick={handleXxx}
  const onClickMatches = content.matchAll(/onClick\s*=\s*\{?\s*handle(\w+)\s*\}?/g);
  for (const match of onClickMatches) {
    handlers.add(`handle${match[1]}`);
  }
  
  // Find onArchive={handleXxx}
  const onArchiveMatches = content.matchAll(/onArchive\s*=\s*\{?\s*handle(\w+)\s*\}?/g);
  for (const match of onArchiveMatches) {
    handlers.add(`handle${match[1]}`);
  }
  
  // Find onRestore={handleXxx}
  const onRestoreMatches = content.matchAll(/onRestore\s*=\s*\{?\s*handle(\w+)\s*\}?/g);
  for (const match of onRestoreMatches) {
    handlers.add(`handle${match[1]}`);
  }
  
  // Find onDelete={handleXxx}
  const onDeleteMatches = content.matchAll(/onDelete\s*=\s*\{?\s*handle(\w+)\s*\}?/g);
  for (const match of onDeleteMatches) {
    handlers.add(`handle${match[1]}`);
  }
  
  return handlers;
}

function extractDefinedFunctions(content) {
  const functions = new Set();
  
  // Find const handleXxx = ...
  const constMatches = content.matchAll(/const\s+(handle\w+)\s*=/g);
  for (const match of constMatches) {
    functions.add(match[1]);
  }
  
  // Find function handleXxx() ...
  const functionMatches = content.matchAll(/function\s+(handle\w+)\s*\(/g);
  for (const match of functionMatches) {
    functions.add(match[1]);
  }
  
  return functions;
}

function checkFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const handlers = extractHandlers(content);
    const definedFunctions = extractDefinedFunctions(content);
    
    const missing = [];
    handlers.forEach(handler => {
      if (!definedFunctions.has(handler)) {
        missing.push(handler);
      }
    });
    
    if (missing.length > 0) {
      return {
        file: filePath.replace(projectRoot, ''),
        missing,
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error checking ${filePath}:`, error.message);
    return null;
  }
}

const files = findJSFiles(srcDir);
const issues = [];

console.log('🔍 Checking for missing handlers...\n');

files.forEach(file => {
  const issue = checkFile(file);
  if (issue) {
    issues.push(issue);
  }
});

if (issues.length > 0) {
  console.log('❌ Found missing handlers:\n');
  issues.forEach(issue => {
    console.log(`  File: ${issue.file}`);
    console.log(`  Missing: ${issue.missing.join(', ')}`);
    console.log('');
  });
  process.exit(1);
} else {
  console.log('✅ No missing handlers found!');
  process.exit(0);
}


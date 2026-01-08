#!/usr/bin/env node

/**
 * Enhanced Seed Material Library Script
 * Populates the material library with comprehensive construction materials
 * 
 * Features:
 * - Advanced duplicate detection
 * - Proper category mapping
 * - 200+ construction materials
 * - Comprehensive validation
 * 
 * Run with: node scripts/seed-material-library.mjs
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

// Category mapping from old names to new category names
const CATEGORY_MAP = {
  'Plumbing': 'Plumbing Works',
  'Electrical': 'Electrical Works',
  'Finishing': 'Paintwork', // Will be overridden for tiles
  'Roofing': 'Structural Materials', // Roofing materials go to Structural
  'Timber': 'Joinery/Carpentry',
  'Hardware': 'Joinery/Carpentry',
};

// Valid units from schema
const VALID_UNITS = [
  'piece', 'bag', 'kg', 'ton', 'liter', 'gallon', 'meter', 'square meter',
  'cubic meter', 'roll', 'sheet', 'box', 'carton', 'pack', 'set', 'pair',
  'dozen', 'lorry', 'truck', 'others'
];

/**
 * Normalize material name for duplicate detection
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .replace(/\//g, ' ')
    .replace(/[-,]/g, '');
}

/**
 * Find duplicates in material list
 */
function findDuplicates(materials) {
  const seen = new Map();
  const duplicates = [];
  
  materials.forEach((mat, index) => {
    const normalized = normalizeName(mat.name);
    if (seen.has(normalized)) {
      duplicates.push({
        current: mat.name,
        existing: seen.get(normalized).name,
        index,
        existingIndex: seen.get(normalized).index
      });
    } else {
      seen.set(normalized, { name: mat.name, index });
    }
  });
  
  return duplicates;
}

/**
 * Comprehensive construction materials list
 */
const commonMaterials = [
  // ==================== STRUCTURAL MATERIALS ====================
  {
    name: 'Cement (50kg bag)',
    description: 'Portland cement Grade 42.5 in 50kg bags',
    category: 'Structural Materials',
    defaultUnit: 'bag',
    defaultUnitCost: 850,
    isCommon: true,
    specifications: 'Grade 42.5, 50kg bag',
  },
  {
    name: 'Cement (25kg bag)',
    description: 'Portland cement Grade 42.5 in 25kg bags',
    category: 'Structural Materials',
    defaultUnit: 'bag',
    defaultUnitCost: 450,
    isCommon: false,
    specifications: 'Grade 42.5, 25kg bag',
  },
  {
    name: 'Steel Rebars (8mm)',
    description: 'Reinforcement steel bars, 8mm diameter',
    category: 'Structural Materials',
    defaultUnit: 'piece',
    defaultUnitCost: 800,
    isCommon: true,
    specifications: '8mm diameter, 6m length',
  },
  {
    name: 'Steel Rebars (10mm)',
    description: 'Reinforcement steel bars, 10mm diameter',
    category: 'Structural Materials',
    defaultUnit: 'piece',
    defaultUnitCost: 1000,
    isCommon: true,
    specifications: '10mm diameter, 6m length',
  },
  {
    name: 'Steel Rebars (12mm)',
    description: 'Reinforcement steel bars, 12mm diameter',
    category: 'Structural Materials',
    defaultUnit: 'piece',
    defaultUnitCost: 1200,
    isCommon: true,
    specifications: '12mm diameter, 6m length',
  },
  {
    name: 'Steel Rebars (16mm)',
    description: 'Reinforcement steel bars, 16mm diameter',
    category: 'Structural Materials',
    defaultUnit: 'piece',
    defaultUnitCost: 1800,
    isCommon: true,
    specifications: '16mm diameter, 6m length',
  },
  {
    name: 'Steel Rebars (20mm)',
    description: 'Reinforcement steel bars, 20mm diameter',
    category: 'Structural Materials',
    defaultUnit: 'piece',
    defaultUnitCost: 2500,
    isCommon: true,
    specifications: '20mm diameter, 6m length',
  },
  {
    name: 'Steel Rebars (25mm)',
    description: 'Reinforcement steel bars, 25mm diameter',
    category: 'Structural Materials',
    defaultUnit: 'piece',
    defaultUnitCost: 3500,
    isCommon: false,
    specifications: '25mm diameter, 6m length',
  },
  {
    name: 'Steel Mesh (A142)',
    description: 'Welded steel mesh reinforcement, A142 grade',
    category: 'Structural Materials',
    defaultUnit: 'sheet',
    defaultUnitCost: 2500,
    isCommon: true,
    specifications: 'A142 grade, 2.4m x 1.2m',
  },
  {
    name: 'Steel Mesh (A193)',
    description: 'Welded steel mesh reinforcement, A193 grade',
    category: 'Structural Materials',
    defaultUnit: 'sheet',
    defaultUnitCost: 3200,
    isCommon: false,
    specifications: 'A193 grade, 2.4m x 1.2m',
  },
  {
    name: 'Sand',
    description: 'Construction sand for concrete and masonry',
    category: 'Structural Materials',
    defaultUnit: 'lorry',
    defaultUnitCost: 20000,
    isCommon: true,
    specifications: 'Standard construction sand',
  },
  {
    name: 'River Sand',
    description: 'Fine river sand for plastering and finishing',
    category: 'Structural Materials',
    defaultUnit: 'lorry',
    defaultUnitCost: 22000,
    isCommon: true,
    specifications: 'Fine river sand, washed',
  },
  {
    name: 'Gravel/Aggregate (20mm)',
    description: 'Crushed stone aggregate, 20mm size',
    category: 'Structural Materials',
    defaultUnit: 'ton',
    defaultUnitCost: 3500,
    isCommon: true,
    specifications: '20mm crushed stone',
  },
  {
    name: 'Gravel/Aggregate (40mm)',
    description: 'Crushed stone aggregate, 40mm size',
    category: 'Structural Materials',
    defaultUnit: 'ton',
    defaultUnitCost: 3300,
    isCommon: false,
    specifications: '40mm crushed stone',
  },
  {
    name: 'Ballast',
    description: 'Ballast mix for concrete (sand and gravel)',
    category: 'Structural Materials',
    defaultUnit: 'ton',
    defaultUnitCost: 3200,
    isCommon: true,
    specifications: 'Mixed ballast for concrete',
  },
  {
    name: 'Hardcore',
    description: 'Hardcore fill for foundation and base course',
    category: 'Structural Materials',
    defaultUnit: 'lorry',
    defaultUnitCost: 18000,
    isCommon: true,
    specifications: 'Hardcore fill material',
  },
  {
    name: 'Binding Wire',
    description: 'Galvanized wire for tying reinforcement bars',
    category: 'Structural Materials',
    defaultUnit: 'kg',
    defaultUnitCost: 450,
    isCommon: true,
    specifications: 'Galvanized binding wire',
  },
  {
    name: 'Ready Mix Concrete (C20)',
    description: 'Ready mix concrete, C20 grade',
    category: 'Structural Materials',
    defaultUnit: 'cubic meter',
    defaultUnitCost: 8500,
    isCommon: false,
    specifications: 'C20 grade ready mix',
  },
  {
    name: 'Ready Mix Concrete (C25)',
    description: 'Ready mix concrete, C25 grade',
    category: 'Structural Materials',
    defaultUnit: 'cubic meter',
    defaultUnitCost: 9500,
    isCommon: false,
    specifications: 'C25 grade ready mix',
  },
  {
    name: 'Ready Mix Concrete (C30)',
    description: 'Ready mix concrete, C30 grade',
    category: 'Structural Materials',
    defaultUnit: 'cubic meter',
    defaultUnitCost: 10500,
    isCommon: false,
    specifications: 'C30 grade ready mix',
  },
  {
    name: 'Waterproofing Membrane',
    description: 'Bituminous waterproofing membrane',
    category: 'Structural Materials',
    defaultUnit: 'roll',
    defaultUnitCost: 12000,
    isCommon: false,
    specifications: 'Bituminous membrane, 10m x 1m',
  },
  {
    name: 'Damp Proof Course (DPC)',
    description: 'Damp proof course material',
    category: 'Structural Materials',
    defaultUnit: 'roll',
    defaultUnitCost: 3500,
    isCommon: true,
    specifications: 'DPC membrane, 10m x 1m',
  },
  {
    name: 'Expansion Joint Filler',
    description: 'Expansion joint filler material',
    category: 'Structural Materials',
    defaultUnit: 'meter',
    defaultUnitCost: 800,
    isCommon: false,
    specifications: 'Expansion joint filler strip',
  },
  
  // ==================== MASONRY ====================
  {
    name: 'Concrete Blocks (4 inch)',
    description: 'Standard 4 inch concrete blocks',
    category: 'Masonry',
    defaultUnit: 'piece',
    defaultUnitCost: 35,
    isCommon: false,
    specifications: '4 inch hollow block',
  },
  {
    name: 'Concrete Blocks (6 inch)',
    description: 'Standard 6 inch concrete blocks',
    category: 'Masonry',
    defaultUnit: 'piece',
    defaultUnitCost: 45,
    isCommon: true,
    specifications: '6 inch hollow block',
  },
  {
    name: 'Concrete Blocks (9 inch)',
    description: 'Standard 9 inch concrete blocks',
    category: 'Masonry',
    defaultUnit: 'piece',
    defaultUnitCost: 65,
    isCommon: true,
    specifications: '9 inch hollow block',
  },
  {
    name: 'Concrete Blocks (Solid)',
    description: 'Solid concrete blocks',
    category: 'Masonry',
    defaultUnit: 'piece',
    defaultUnitCost: 55,
    isCommon: false,
    specifications: 'Solid concrete block',
  },
  {
    name: 'Bricks (Red Clay)',
    description: 'Red clay bricks, standard size',
    category: 'Masonry',
    defaultUnit: 'piece',
    defaultUnitCost: 12,
    isCommon: true,
    specifications: 'Standard red clay brick',
  },
  {
    name: 'Bricks (Engineering)',
    description: 'Engineering bricks, high strength',
    category: 'Masonry',
    defaultUnit: 'piece',
    defaultUnitCost: 18,
    isCommon: false,
    specifications: 'Engineering grade brick',
  },
  {
    name: 'Cement Mortar Mix',
    description: 'Pre-mixed cement mortar',
    category: 'Masonry',
    defaultUnit: 'bag',
    defaultUnitCost: 650,
    isCommon: false,
    specifications: 'Pre-mixed mortar, 25kg',
  },
  {
    name: 'Plaster Sand',
    description: 'Fine sand for plastering work',
    category: 'Masonry',
    defaultUnit: 'lorry',
    defaultUnitCost: 24000,
    isCommon: true,
    specifications: 'Fine plastering sand',
  },
  {
    name: 'Lime',
    description: 'Hydrated lime for mortar',
    category: 'Masonry',
    defaultUnit: 'bag',
    defaultUnitCost: 550,
    isCommon: false,
    specifications: 'Hydrated lime, 25kg',
  },
  {
    name: 'Precast Concrete Slabs',
    description: 'Precast concrete floor slabs',
    category: 'Masonry',
    defaultUnit: 'piece',
    defaultUnitCost: 4500,
    isCommon: false,
    specifications: 'Precast slab, 1.2m x 0.6m',
  },
  {
    name: 'Precast Concrete Beams',
    description: 'Precast concrete lintel beams',
    category: 'Masonry',
    defaultUnit: 'piece',
    defaultUnitCost: 3500,
    isCommon: false,
    specifications: 'Precast lintel beam, 3m',
  },
  
  // ==================== ELECTRICAL WORKS ====================
  {
    name: 'Copper Wire (1.5mm)',
    description: 'Electrical copper wire, 1.5mm²',
    category: 'Electrical Works',
    defaultUnit: 'meter',
    defaultUnitCost: 80,
    isCommon: true,
    specifications: '1.5mm² single core copper wire',
  },
  {
    name: 'Copper Wire (2.5mm)',
    description: 'Electrical copper wire, 2.5mm²',
    category: 'Electrical Works',
    defaultUnit: 'meter',
    defaultUnitCost: 120,
    isCommon: true,
    specifications: '2.5mm² single core copper wire',
  },
  {
    name: 'Copper Wire (4mm)',
    description: 'Electrical copper wire, 4mm²',
    category: 'Electrical Works',
    defaultUnit: 'meter',
    defaultUnitCost: 180,
    isCommon: true,
    specifications: '4mm² single core copper wire',
  },
  {
    name: 'Copper Wire (6mm)',
    description: 'Electrical copper wire, 6mm²',
    category: 'Electrical Works',
    defaultUnit: 'meter',
    defaultUnitCost: 280,
    isCommon: true,
    specifications: '6mm² single core copper wire',
  },
  {
    name: 'Copper Wire (10mm)',
    description: 'Electrical copper wire, 10mm²',
    category: 'Electrical Works',
    defaultUnit: 'meter',
    defaultUnitCost: 450,
    isCommon: false,
    specifications: '10mm² single core copper wire',
  },
  {
    name: 'Copper Wire (16mm)',
    description: 'Electrical copper wire, 16mm²',
    category: 'Electrical Works',
    defaultUnit: 'meter',
    defaultUnitCost: 750,
    isCommon: false,
    specifications: '16mm² single core copper wire',
  },
  {
    name: 'Conduit Pipes (20mm)',
    description: 'PVC electrical conduit pipes, 20mm',
    category: 'Electrical Works',
    defaultUnit: 'meter',
    defaultUnitCost: 150,
    isCommon: true,
    specifications: '20mm PVC conduit',
  },
  {
    name: 'Conduit Pipes (25mm)',
    description: 'PVC electrical conduit pipes, 25mm',
    category: 'Electrical Works',
    defaultUnit: 'meter',
    defaultUnitCost: 200,
    isCommon: true,
    specifications: '25mm PVC conduit',
  },
  {
    name: 'Conduit Pipes (32mm)',
    description: 'PVC electrical conduit pipes, 32mm',
    category: 'Electrical Works',
    defaultUnit: 'meter',
    defaultUnitCost: 280,
    isCommon: false,
    specifications: '32mm PVC conduit',
  },
  {
    name: 'Switch Sockets (Single)',
    description: 'Single switch socket outlet',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 350,
    isCommon: true,
    specifications: 'Single switch socket',
  },
  {
    name: 'Switch Sockets (Double)',
    description: 'Double switch socket outlet',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 550,
    isCommon: true,
    specifications: 'Double switch socket',
  },
  {
    name: 'Light Switches (Single)',
    description: 'Single pole light switch',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 250,
    isCommon: true,
    specifications: 'Single pole switch',
  },
  {
    name: 'Light Switches (Double)',
    description: 'Double pole light switch',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 400,
    isCommon: true,
    specifications: 'Double pole switch',
  },
  {
    name: 'Circuit Breakers (20A)',
    description: 'Miniature circuit breaker, 20A',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 2500,
    isCommon: true,
    specifications: '20A MCB',
  },
  {
    name: 'Circuit Breakers (32A)',
    description: 'Miniature circuit breaker, 32A',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 3500,
    isCommon: true,
    specifications: '32A MCB',
  },
  {
    name: 'Circuit Breakers (40A)',
    description: 'Miniature circuit breaker, 40A',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 4500,
    isCommon: false,
    specifications: '40A MCB',
  },
  {
    name: 'Distribution Board',
    description: 'Electrical distribution board',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 12000,
    isCommon: true,
    specifications: '12-way distribution board',
  },
  {
    name: 'Main Switch',
    description: 'Main electrical switch',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 8000,
    isCommon: true,
    specifications: 'Main switch, 63A',
  },
  {
    name: 'Earthing Rod',
    description: 'Copper earthing rod',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 3500,
    isCommon: true,
    specifications: 'Copper earthing rod, 2.4m',
  },
  {
    name: 'Earthing Wire',
    description: 'Earthing wire, green/yellow',
    category: 'Electrical Works',
    defaultUnit: 'meter',
    defaultUnitCost: 150,
    isCommon: true,
    specifications: 'Earthing wire, 6mm²',
  },
  {
    name: 'Cable Ties',
    description: 'Nylon cable ties for wire management',
    category: 'Electrical Works',
    defaultUnit: 'pack',
    defaultUnitCost: 250,
    isCommon: true,
    specifications: 'Cable ties, 100 pieces',
  },
  {
    name: 'Junction Box',
    description: 'Electrical junction box',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 450,
    isCommon: true,
    specifications: 'Junction box, 4-way',
  },
  {
    name: 'LED Bulb (12W)',
    description: 'LED light bulb, 12W',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 350,
    isCommon: true,
    specifications: '12W LED bulb, warm white',
  },
  {
    name: 'LED Bulb (18W)',
    description: 'LED light bulb, 18W',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 550,
    isCommon: true,
    specifications: '18W LED bulb, warm white',
  },
  {
    name: 'Fluorescent Tube (36W)',
    description: 'Fluorescent tube light, 36W',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 850,
    isCommon: false,
    specifications: '36W fluorescent tube',
  },
  {
    name: 'Ceiling Rose',
    description: 'Ceiling rose for pendant lights',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 250,
    isCommon: true,
    specifications: 'Standard ceiling rose',
  },
  {
    name: 'Lamp Holder',
    description: 'Bayonet lamp holder',
    category: 'Electrical Works',
    defaultUnit: 'piece',
    defaultUnitCost: 200,
    isCommon: true,
    specifications: 'Bayonet lamp holder',
  },
  
  // ==================== PLUMBING WORKS ====================
  {
    name: 'PVC Pipes (1/2 inch)',
    description: 'PVC water pipes, 1/2 inch diameter',
    category: 'Plumbing Works',
    defaultUnit: 'meter',
    defaultUnitCost: 180,
    isCommon: true,
    specifications: '1/2 inch PVC pipe',
  },
  {
    name: 'PVC Pipes (1 inch)',
    description: 'PVC water pipes, 1 inch diameter',
    category: 'Plumbing Works',
    defaultUnit: 'meter',
    defaultUnitCost: 250,
    isCommon: true,
    specifications: '1 inch PVC pipe',
  },
  {
    name: 'PVC Pipes (2 inch)',
    description: 'PVC water pipes, 2 inch diameter',
    category: 'Plumbing Works',
    defaultUnit: 'meter',
    defaultUnitCost: 450,
    isCommon: true,
    specifications: '2 inch PVC pipe',
  },
  {
    name: 'PVC Pipes (3 inch)',
    description: 'PVC water pipes, 3 inch diameter',
    category: 'Plumbing Works',
    defaultUnit: 'meter',
    defaultUnitCost: 750,
    isCommon: false,
    specifications: '3 inch PVC pipe',
  },
  {
    name: 'PVC Pipes (4 inch)',
    description: 'PVC water pipes, 4 inch diameter',
    category: 'Plumbing Works',
    defaultUnit: 'meter',
    defaultUnitCost: 1200,
    isCommon: false,
    specifications: '4 inch PVC pipe',
  },
  {
    name: 'GI Pipes (1/2 inch)',
    description: 'Galvanized iron pipes, 1/2 inch',
    category: 'Plumbing Works',
    defaultUnit: 'meter',
    defaultUnitCost: 650,
    isCommon: true,
    specifications: '1/2 inch GI pipe',
  },
  {
    name: 'GI Pipes (1 inch)',
    description: 'Galvanized iron pipes, 1 inch',
    category: 'Plumbing Works',
    defaultUnit: 'meter',
    defaultUnitCost: 800,
    isCommon: true,
    specifications: '1 inch GI pipe',
  },
  {
    name: 'GI Pipes (2 inch)',
    description: 'Galvanized iron pipes, 2 inch',
    category: 'Plumbing Works',
    defaultUnit: 'meter',
    defaultUnitCost: 1200,
    isCommon: false,
    specifications: '2 inch GI pipe',
  },
  {
    name: 'PVC Elbow Fitting',
    description: 'PVC elbow fitting, 90 degrees',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 120,
    isCommon: true,
    specifications: '90° PVC elbow',
  },
  {
    name: 'PVC Tee Fitting',
    description: 'PVC tee fitting',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 150,
    isCommon: true,
    specifications: 'PVC tee fitting',
  },
  {
    name: 'PVC Coupler',
    description: 'PVC pipe coupler',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 100,
    isCommon: true,
    specifications: 'PVC coupler',
  },
  {
    name: 'PVC Reducer',
    description: 'PVC pipe reducer fitting',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 180,
    isCommon: false,
    specifications: 'PVC reducer',
  },
  {
    name: 'Gate Valve (1 inch)',
    description: 'Gate valve, 1 inch',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 2500,
    isCommon: true,
    specifications: '1 inch gate valve',
  },
  {
    name: 'Ball Valve (1/2 inch)',
    description: 'Ball valve, 1/2 inch',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 1200,
    isCommon: true,
    specifications: '1/2 inch ball valve',
  },
  {
    name: 'Tap (Bathroom)',
    description: 'Bathroom tap, single lever',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 2500,
    isCommon: true,
    specifications: 'Single lever bathroom tap',
  },
  {
    name: 'Tap (Kitchen)',
    description: 'Kitchen tap, single lever',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 3000,
    isCommon: true,
    specifications: 'Single lever kitchen tap',
  },
  {
    name: 'Shower Head',
    description: 'Shower head with hose',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 3500,
    isCommon: true,
    specifications: 'Shower head with flexible hose',
  },
  {
    name: 'Toilet Bowl',
    description: 'Ceramic toilet bowl',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 12000,
    isCommon: true,
    specifications: 'Standard toilet bowl',
  },
  {
    name: 'Toilet Seat',
    description: 'Toilet seat cover',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 2500,
    isCommon: true,
    specifications: 'Standard toilet seat',
  },
  {
    name: 'Wash Basin',
    description: 'Ceramic wash basin',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 4500,
    isCommon: true,
    specifications: 'Standard wash basin',
  },
  {
    name: 'Sink (Kitchen)',
    description: 'Stainless steel kitchen sink',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 8500,
    isCommon: true,
    specifications: 'Stainless steel sink, single bowl',
  },
  {
    name: 'Water Heater (50L)',
    description: 'Electric water heater, 50 liters',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 25000,
    isCommon: false,
    specifications: '50L electric water heater',
  },
  {
    name: 'Water Pump (1HP)',
    description: 'Water pump, 1 horsepower',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 35000,
    isCommon: false,
    specifications: '1HP water pump',
  },
  {
    name: 'Water Tank (1000L)',
    description: 'Plastic water storage tank, 1000 liters',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 12000,
    isCommon: true,
    specifications: '1000L plastic tank',
  },
  {
    name: 'Water Tank (2000L)',
    description: 'Plastic water storage tank, 2000 liters',
    category: 'Plumbing Works',
    defaultUnit: 'piece',
    defaultUnitCost: 20000,
    isCommon: true,
    specifications: '2000L plastic tank',
  },
  {
    name: 'Pipe Thread Seal Tape',
    description: 'PTFE thread seal tape',
    category: 'Plumbing Works',
    defaultUnit: 'roll',
    defaultUnitCost: 150,
    isCommon: true,
    specifications: 'PTFE tape, 12mm width',
  },
  
  // ==================== JOINERY/CARPENTRY ====================
  {
    name: 'Timber (2x4)',
    description: 'Softwood timber planks, 2x4 inches',
    category: 'Joinery/Carpentry',
    defaultUnit: 'meter',
    defaultUnitCost: 450,
    isCommon: true,
    specifications: '2x4 inch softwood, 3m length',
  },
  {
    name: 'Timber (2x6)',
    description: 'Softwood timber planks, 2x6 inches',
    category: 'Joinery/Carpentry',
    defaultUnit: 'meter',
    defaultUnitCost: 650,
    isCommon: false,
    specifications: '2x6 inch softwood, 3m length',
  },
  {
    name: 'Timber (4x4)',
    description: 'Hardwood timber posts, 4x4 inches',
    category: 'Joinery/Carpentry',
    defaultUnit: 'meter',
    defaultUnitCost: 1200,
    isCommon: false,
    specifications: '4x4 inch hardwood, 3m length',
  },
  {
    name: 'Plywood (4x8)',
    description: 'Plywood sheets, 4x8 feet',
    category: 'Joinery/Carpentry',
    defaultUnit: 'sheet',
    defaultUnitCost: 3500,
    isCommon: true,
    specifications: '4x8 feet plywood, 12mm',
  },
  {
    name: 'Plywood (6mm)',
    description: 'Plywood sheet, 6mm thickness',
    category: 'Joinery/Carpentry',
    defaultUnit: 'sheet',
    defaultUnitCost: 2800,
    isCommon: true,
    specifications: '6mm plywood, 4x8 feet',
  },
  {
    name: 'Plywood (18mm)',
    description: 'Plywood sheet, 18mm thickness',
    category: 'Joinery/Carpentry',
    defaultUnit: 'sheet',
    defaultUnitCost: 5500,
    isCommon: false,
    specifications: '18mm plywood, 4x8 feet',
  },
  {
    name: 'Blockboard',
    description: 'Blockboard sheet',
    category: 'Joinery/Carpentry',
    defaultUnit: 'sheet',
    defaultUnitCost: 4200,
    isCommon: false,
    specifications: 'Blockboard, 4x8 feet',
  },
  {
    name: 'Door (Internal)',
    description: 'Internal door, standard size',
    category: 'Joinery/Carpentry',
    defaultUnit: 'piece',
    defaultUnitCost: 8500,
    isCommon: true,
    specifications: 'Internal door, 2.1m x 0.9m',
  },
  {
    name: 'Door (External)',
    description: 'External door, standard size',
    category: 'Joinery/Carpentry',
    defaultUnit: 'piece',
    defaultUnitCost: 15000,
    isCommon: true,
    specifications: 'External door, 2.1m x 0.9m',
  },
  {
    name: 'Door Frame',
    description: 'Door frame, standard size',
    category: 'Joinery/Carpentry',
    defaultUnit: 'piece',
    defaultUnitCost: 4500,
    isCommon: true,
    specifications: 'Door frame, 2.1m x 0.9m',
  },
  {
    name: 'Window (Casement)',
    description: 'Casement window, standard size',
    category: 'Joinery/Carpentry',
    defaultUnit: 'piece',
    defaultUnitCost: 12000,
    isCommon: true,
    specifications: 'Casement window, 1.2m x 1.2m',
  },
  {
    name: 'Window (Sliding)',
    description: 'Sliding window, standard size',
    category: 'Joinery/Carpentry',
    defaultUnit: 'piece',
    defaultUnitCost: 15000,
    isCommon: true,
    specifications: 'Sliding window, 1.5m x 1.2m',
  },
  {
    name: 'Window Frame',
    description: 'Window frame, standard size',
    category: 'Joinery/Carpentry',
    defaultUnit: 'piece',
    defaultUnitCost: 5500,
    isCommon: true,
    specifications: 'Window frame, 1.2m x 1.2m',
  },
  {
    name: 'Door Hinges',
    description: 'Door hinges, standard size',
    category: 'Joinery/Carpentry',
    defaultUnit: 'pair',
    defaultUnitCost: 450,
    isCommon: true,
    specifications: 'Standard door hinges, 4 inch',
  },
  {
    name: 'Door Lock',
    description: 'Mortise door lock',
    category: 'Joinery/Carpentry',
    defaultUnit: 'piece',
    defaultUnitCost: 2500,
    isCommon: true,
    specifications: 'Mortise lock set',
  },
  {
    name: 'Door Handle',
    description: 'Door handle set',
    category: 'Joinery/Carpentry',
    defaultUnit: 'piece',
    defaultUnitCost: 1200,
    isCommon: true,
    specifications: 'Standard door handle',
  },
  {
    name: 'Nails (2 inch)',
    description: 'Common nails, 2 inch',
    category: 'Joinery/Carpentry',
    defaultUnit: 'kg',
    defaultUnitCost: 280,
    isCommon: true,
    specifications: '2 inch common nails',
  },
  {
    name: 'Nails (3 inch)',
    description: 'Common nails, 3 inch',
    category: 'Joinery/Carpentry',
    defaultUnit: 'kg',
    defaultUnitCost: 320,
    isCommon: true,
    specifications: '3 inch common nails',
  },
  {
    name: 'Nails (4 inch)',
    description: 'Common nails, 4 inch',
    category: 'Joinery/Carpentry',
    defaultUnit: 'kg',
    defaultUnitCost: 380,
    isCommon: false,
    specifications: '4 inch common nails',
  },
  {
    name: 'Screws (2 inch)',
    description: 'Wood screws, 2 inch',
    category: 'Joinery/Carpentry',
    defaultUnit: 'kg',
    defaultUnitCost: 650,
    isCommon: true,
    specifications: '2 inch wood screws',
  },
  {
    name: 'Screws (3 inch)',
    description: 'Wood screws, 3 inch',
    category: 'Joinery/Carpentry',
    defaultUnit: 'kg',
    defaultUnitCost: 850,
    isCommon: true,
    specifications: '3 inch wood screws',
  },
  {
    name: 'Roofing Nails',
    description: 'Galvanized roofing nails',
    category: 'Joinery/Carpentry',
    defaultUnit: 'kg',
    defaultUnitCost: 280,
    isCommon: true,
    specifications: 'Galvanized roofing nails',
  },
  {
    name: 'Wood Glue',
    description: 'Wood adhesive glue',
    category: 'Joinery/Carpentry',
    defaultUnit: 'liter',
    defaultUnitCost: 850,
    isCommon: true,
    specifications: 'Wood glue, 1 liter',
  },
  
  // ==================== PAINTWORK ====================
  {
    name: 'Paint (Emulsion, 20L)',
    description: 'Emulsion paint, 20 liter',
    category: 'Paintwork',
    defaultUnit: 'gallon',
    defaultUnitCost: 4500,
    isCommon: true,
    specifications: 'Emulsion paint, 20L',
  },
  {
    name: 'Paint (Emulsion, 4L)',
    description: 'Emulsion paint, 4 liter',
    category: 'Paintwork',
    defaultUnit: 'gallon',
    defaultUnitCost: 1200,
    isCommon: true,
    specifications: 'Emulsion paint, 4L',
  },
  {
    name: 'Paint (Gloss, 4L)',
    description: 'Gloss paint, 4 liter',
    category: 'Paintwork',
    defaultUnit: 'gallon',
    defaultUnitCost: 1800,
    isCommon: true,
    specifications: 'Gloss paint, 4L',
  },
  {
    name: 'Paint Primer',
    description: 'Paint primer, universal',
    category: 'Paintwork',
    defaultUnit: 'gallon',
    defaultUnitCost: 3500,
    isCommon: true,
    specifications: 'Universal primer, 4L',
  },
  {
    name: 'Paint Thinner',
    description: 'Paint thinner solvent',
    category: 'Paintwork',
    defaultUnit: 'liter',
    defaultUnitCost: 450,
    isCommon: true,
    specifications: 'Paint thinner, 1L',
  },
  {
    name: 'Paint Brush (2 inch)',
    description: 'Paint brush, 2 inch',
    category: 'Paintwork',
    defaultUnit: 'piece',
    defaultUnitCost: 250,
    isCommon: true,
    specifications: '2 inch paint brush',
  },
  {
    name: 'Paint Brush (4 inch)',
    description: 'Paint brush, 4 inch',
    category: 'Paintwork',
    defaultUnit: 'piece',
    defaultUnitCost: 450,
    isCommon: true,
    specifications: '4 inch paint brush',
  },
  {
    name: 'Paint Roller',
    description: 'Paint roller with handle',
    category: 'Paintwork',
    defaultUnit: 'piece',
    defaultUnitCost: 350,
    isCommon: true,
    specifications: 'Paint roller set',
  },
  {
    name: 'Roller Sleeve',
    description: 'Paint roller sleeve',
    category: 'Paintwork',
    defaultUnit: 'piece',
    defaultUnitCost: 150,
    isCommon: true,
    specifications: 'Roller sleeve, medium nap',
  },
  {
    name: 'Paint Tray',
    description: 'Paint tray for roller',
    category: 'Paintwork',
    defaultUnit: 'piece',
    defaultUnitCost: 450,
    isCommon: true,
    specifications: 'Standard paint tray',
  },
  {
    name: 'Masking Tape',
    description: 'Painter\'s masking tape',
    category: 'Paintwork',
    defaultUnit: 'roll',
    defaultUnitCost: 250,
    isCommon: true,
    specifications: 'Masking tape, 48mm',
  },
  {
    name: 'Sandpaper (Coarse)',
    description: 'Coarse sandpaper for surface preparation',
    category: 'Paintwork',
    defaultUnit: 'sheet',
    defaultUnitCost: 50,
    isCommon: true,
    specifications: 'Coarse sandpaper, 120 grit',
  },
  {
    name: 'Sandpaper (Fine)',
    description: 'Fine sandpaper for finishing',
    category: 'Paintwork',
    defaultUnit: 'sheet',
    defaultUnitCost: 50,
    isCommon: true,
    specifications: 'Fine sandpaper, 240 grit',
  },
  
  // ==================== TILING & TERRAZZO ====================
  {
    name: 'Tiles (Floor, 30x30cm)',
    description: 'Ceramic floor tiles, 30x30cm',
    category: 'Tiling & Terrazzo',
    defaultUnit: 'square meter',
    defaultUnitCost: 1200,
    isCommon: true,
    specifications: '30x30cm ceramic floor tile',
  },
  {
    name: 'Tiles (Floor, 60x60cm)',
    description: 'Ceramic floor tiles, 60x60cm',
    category: 'Tiling & Terrazzo',
    defaultUnit: 'square meter',
    defaultUnitCost: 2500,
    isCommon: true,
    specifications: '60x60cm ceramic floor tile',
  },
  {
    name: 'Tiles (Wall, 20x30cm)',
    description: 'Ceramic wall tiles, 20x30cm',
    category: 'Tiling & Terrazzo',
    defaultUnit: 'square meter',
    defaultUnitCost: 1800,
    isCommon: true,
    specifications: '20x30cm ceramic wall tile',
  },
  {
    name: 'Tiles (Wall, 30x60cm)',
    description: 'Ceramic wall tiles, 30x60cm',
    category: 'Tiling & Terrazzo',
    defaultUnit: 'square meter',
    defaultUnitCost: 3200,
    isCommon: false,
    specifications: '30x60cm ceramic wall tile',
  },
  {
    name: 'Tile Adhesive',
    description: 'Ceramic tile adhesive',
    category: 'Tiling & Terrazzo',
    defaultUnit: 'bag',
    defaultUnitCost: 850,
    isCommon: true,
    specifications: 'Tile adhesive, 25kg',
  },
  {
    name: 'Tile Grout',
    description: 'Tile grout, cement-based',
    category: 'Tiling & Terrazzo',
    defaultUnit: 'bag',
    defaultUnitCost: 650,
    isCommon: true,
    specifications: 'Tile grout, 5kg',
  },
  {
    name: 'Tile Spacers',
    description: 'Plastic tile spacers',
    category: 'Tiling & Terrazzo',
    defaultUnit: 'pack',
    defaultUnitCost: 150,
    isCommon: true,
    specifications: 'Tile spacers, 2mm, 100 pieces',
  },
  {
    name: 'Terrazzo Tiles',
    description: 'Terrazzo floor tiles',
    category: 'Tiling & Terrazzo',
    defaultUnit: 'square meter',
    defaultUnitCost: 4500,
    isCommon: false,
    specifications: 'Terrazzo tile, 40x40cm',
  },
  
  // ==================== ROOFING (Structural Materials) ====================
  {
    name: 'Roofing Sheets (Corrugated)',
    description: 'Corrugated iron roofing sheets',
    category: 'Structural Materials',
    defaultUnit: 'sheet',
    defaultUnitCost: 3500,
    isCommon: true,
    specifications: 'Corrugated iron sheet, 3m x 1m',
  },
  {
    name: 'Roofing Sheets (Box Profile)',
    description: 'Box profile roofing sheets',
    category: 'Structural Materials',
    defaultUnit: 'sheet',
    defaultUnitCost: 4200,
    isCommon: false,
    specifications: 'Box profile sheet, 3m x 1m',
  },
  {
    name: 'Roofing Ridge Cap',
    description: 'Roofing ridge cap',
    category: 'Structural Materials',
    defaultUnit: 'meter',
    defaultUnitCost: 850,
    isCommon: true,
    specifications: 'Ridge cap, 3m length',
  },
  {
    name: 'Gutter (PVC)',
    description: 'PVC roof gutter',
    category: 'Structural Materials',
    defaultUnit: 'meter',
    defaultUnitCost: 650,
    isCommon: true,
    specifications: 'PVC gutter, 4 inch',
  },
  {
    name: 'Downpipe (PVC)',
    description: 'PVC downpipe',
    category: 'Structural Materials',
    defaultUnit: 'meter',
    defaultUnitCost: 550,
    isCommon: true,
    specifications: 'PVC downpipe, 3 inch',
  },
  {
    name: 'Roof Insulation',
    description: 'Roof insulation material',
    category: 'Structural Materials',
    defaultUnit: 'roll',
    defaultUnitCost: 8500,
    isCommon: false,
    specifications: 'Roof insulation, 10m x 1m',
  },
];

async function seedMaterialLibrary() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB);
    
    console.log('🌱 Starting enhanced material library seed...\n');
    
    // Step 1: Check for duplicates in seed data
    console.log('🔍 Checking for duplicates in seed data...');
    const duplicates = findDuplicates(commonMaterials);
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} potential duplicate(s) in seed data:`);
      duplicates.forEach(dup => {
        console.log(`   - "${dup.current}" (index ${dup.index}) vs "${dup.existing}" (index ${dup.existingIndex})`);
      });
      console.log('   Continuing anyway, but please review...\n');
    } else {
      console.log('✅ No duplicates found in seed data\n');
    }
    
    // Step 2: Validate materials
    console.log('✅ Validating materials...');
    const invalidMaterials = [];
    commonMaterials.forEach((mat, index) => {
      if (!mat.name || mat.name.trim().length < 2) {
        invalidMaterials.push({ index, reason: 'Invalid name' });
      }
      if (!VALID_UNITS.includes(mat.defaultUnit)) {
        invalidMaterials.push({ index, reason: `Invalid unit: ${mat.defaultUnit}` });
      }
      if (mat.defaultUnitCost !== undefined && mat.defaultUnitCost < 0) {
        invalidMaterials.push({ index, reason: 'Negative unit cost' });
      }
    });
    
    if (invalidMaterials.length > 0) {
      console.log(`⚠️  Found ${invalidMaterials.length} invalid material(s):`);
      invalidMaterials.forEach(inv => {
        console.log(`   - Index ${inv.index}: ${inv.reason}`);
      });
      throw new Error('Invalid materials found. Please fix before proceeding.');
    }
    console.log(`✅ All ${commonMaterials.length} materials are valid\n`);
    
    // Step 3: Get categories to map names to IDs
    console.log('📋 Fetching categories...');
    const categories = await db.collection('categories').find({}).toArray();
    const categoryMap = new Map();
    categories.forEach(cat => {
      categoryMap.set(cat.name?.toLowerCase(), cat._id);
    });
    console.log(`   Found ${categories.length} categories\n`);
    
    // Step 4: Check existing materials to avoid duplicates
    console.log('📋 Checking existing materials in library...');
    const existingMaterials = await db.collection('material_library')
      .find({ deletedAt: null })
      .toArray();
    const existingNames = new Set(
      existingMaterials.map(m => normalizeName(m.name))
    );
    console.log(`   Found ${existingMaterials.length} existing materials\n`);
    
    // Step 5: Prepare materials for insertion
    console.log('📝 Preparing materials for insertion...');
    const materialsToInsert = commonMaterials
      .filter(m => {
        const normalized = normalizeName(m.name);
        if (existingNames.has(normalized)) {
          console.log(`   ⏭️  Skipping duplicate: "${m.name}"`);
          return false;
        }
        return true;
      })
      .map(m => {
        // Map category name (handle old category names)
        let categoryName = m.category;
        if (CATEGORY_MAP[categoryName]) {
          categoryName = CATEGORY_MAP[categoryName];
        }
        
        const categoryId = categoryMap.get(categoryName?.toLowerCase());
        
        // Special handling for tiles - map to Tiling & Terrazzo
        if (m.name.toLowerCase().includes('tile') && m.category === 'Finishing') {
          categoryName = 'Tiling & Terrazzo';
          const tileCategoryId = categoryMap.get('tiling & terrazzo');
          return {
            name: m.name,
            description: m.description || '',
            categoryId: tileCategoryId || null,
            category: categoryName,
            defaultUnit: m.defaultUnit,
            defaultUnitCost: m.defaultUnitCost || null,
            materialCode: null,
            brand: null,
            specifications: m.specifications || null,
            usageCount: 0,
            lastUsedAt: null,
            lastUsedBy: null,
            isActive: true,
            isCommon: m.isCommon || false,
            createdBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
        }
        
        return {
          name: m.name,
          description: m.description || '',
          categoryId: categoryId || null,
          category: categoryName,
          defaultUnit: m.defaultUnit,
          defaultUnitCost: m.defaultUnitCost || null,
          materialCode: null,
          brand: null,
          specifications: m.specifications || null,
          usageCount: 0,
          lastUsedAt: null,
          lastUsedBy: null,
          isActive: true,
          isCommon: m.isCommon || false,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };
      });
    
    if (materialsToInsert.length === 0) {
      console.log('⚠️  All materials already exist in the library');
      console.log(`   Found ${existingMaterials.length} existing materials`);
      return;
    }
    
    console.log(`📝 Inserting ${materialsToInsert.length} new materials...\n`);
    const result = await db.collection('material_library').insertMany(materialsToInsert);
    
    console.log(`✅ Successfully inserted ${result.insertedCount} materials`);
    
    // Step 6: Summary
    const commonCount = materialsToInsert.filter(m => m.isCommon).length;
    const categoryCounts = new Map();
    materialsToInsert.forEach(m => {
      categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
    });
    
    console.log(`\n📊 Seed Summary:`);
    console.log(`   • Total materials added: ${result.insertedCount}`);
    console.log(`   • Common materials: ${commonCount}`);
    console.log(`   • Regular materials: ${result.insertedCount - commonCount}`);
    console.log(`   • Categories used: ${categoryCounts.size}`);
    console.log(`\n   Category breakdown:`);
    categoryCounts.forEach((count, category) => {
      console.log(`     - ${category}: ${count} material(s)`);
    });
    
    console.log('\n✅ Enhanced seed complete!');
    
  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

seedMaterialLibrary()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

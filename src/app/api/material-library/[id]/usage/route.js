/**
 * Material Library Usage Check API Route
 * GET: Check where a material library entry is being used
 * 
 * GET /api/material-library/[id]/usage
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid material library ID', 400);
    }

    const db = await getDatabase();
    const materialId = new ObjectId(id);

    // Check if material exists
    const material = await db.collection('material_library').findOne({
      _id: materialId,
      deletedAt: null,
    });

    if (!material) {
      return errorResponse('Material not found in library', 404);
    }

    // Check usage in different collections
    const usage = {
      materialRequests: {
        count: 0,
        items: [],
      },
      materials: {
        count: 0,
        items: [],
      },
      materialTemplates: {
        count: 0,
        items: [],
      },
      total: 0,
    };

    // Check material requests
    const requests = await db.collection('material_requests')
      .find({
        libraryMaterialId: materialId,
        deletedAt: null,
      })
      .limit(10)
      .toArray();

    usage.materialRequests.count = await db.collection('material_requests').countDocuments({
      libraryMaterialId: materialId,
      deletedAt: null,
    });

    usage.materialRequests.items = requests.map(req => ({
      _id: req._id.toString(),
      requestNumber: req.requestNumber,
      materialName: req.materialName,
      status: req.status,
      projectId: req.projectId?.toString(),
      createdAt: req.createdAt,
    }));

    // Check materials (inventory)
    const materials = await db.collection('materials')
      .find({
        libraryMaterialId: materialId,
        deletedAt: null,
      })
      .limit(10)
      .toArray();

    usage.materials.count = await db.collection('materials').countDocuments({
      libraryMaterialId: materialId,
      deletedAt: null,
    });

    usage.materials.items = materials.map(mat => ({
      _id: mat._id.toString(),
      name: mat.name || mat.materialName,
      quantity: mat.quantity,
      unit: mat.unit,
      projectId: mat.projectId?.toString(),
      createdAt: mat.createdAt,
    }));

    // Check material templates
    const templates = await db.collection('material_templates')
      .find({
        'materials.libraryMaterialId': materialId,
        deletedAt: null,
      })
      .limit(10)
      .toArray();

    usage.materialTemplates.count = await db.collection('material_templates').countDocuments({
      'materials.libraryMaterialId': materialId,
      deletedAt: null,
    });

    usage.materialTemplates.items = templates.map(template => ({
      _id: template._id.toString(),
      templateName: template.templateName,
      projectId: template.projectId?.toString(),
      createdAt: template.createdAt,
    }));

    usage.total = usage.materialRequests.count + usage.materials.count + usage.materialTemplates.count;

    return successResponse(usage);
  } catch (error) {
    console.error('Get material usage error:', error);
    return errorResponse('Failed to check material usage', 500);
  }
}

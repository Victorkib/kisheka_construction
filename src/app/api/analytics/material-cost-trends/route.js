/**
 * Material Cost Trends API Route
 * GET: Get cost trends over time for materials
 * 
 * GET /api/analytics/material-cost-trends
 * Auth: OWNER, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/analytics/material-cost-trends
 * Returns cost trends over time for materials
 * Query params: projectId, materialName, categoryId, startDate, endDate, groupBy
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasViewPermission = await hasPermission(user.id, 'view_reports');
    if (!hasViewPermission) {
      return errorResponse(
        'Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can view analytics.',
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const materialName = searchParams.get('materialName');
    const categoryId = searchParams.get('categoryId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'month'; // 'month', 'week', 'day'

    const db = await getDatabase();

    // Build query for purchase orders
    const query = {
      deletedAt: null,
      status: { $in: ['order_accepted', 'ready_for_delivery', 'delivered'] },
    };

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (categoryId && ObjectId.isValid(categoryId)) {
      query.categoryId = new ObjectId(categoryId);
    }

    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get purchase orders
    const purchaseOrders = await db.collection('purchase_orders').find(query).toArray();

    // Group by period and material
    const trendsMap = {};
    const materialCosts = {};

    purchaseOrders.forEach((po) => {
      const date = new Date(po.createdAt);
      let period;

      switch (groupBy) {
        case 'day':
          period = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          period = `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getDate() + 6) / 7)}`;
          break;
        case 'month':
        default:
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      // Process materials in bulk orders
      if (po.materials && Array.isArray(po.materials)) {
        po.materials.forEach((material) => {
          const matName = material.materialName || po.materialName || 'Unknown';
          
          // Filter by material name if provided
          if (materialName && !matName.toLowerCase().includes(materialName.toLowerCase())) {
            return;
          }

          if (!trendsMap[period]) {
            trendsMap[period] = {};
          }

          if (!trendsMap[period][matName]) {
            trendsMap[period][matName] = {
              materialName: matName,
              totalQuantity: 0,
              totalCost: 0,
              averageUnitCost: 0,
              orderCount: 0,
            };
          }

          const trend = trendsMap[period][matName];
          trend.totalQuantity += material.quantity || 0;
          trend.totalCost += material.totalCost || 0;
          trend.orderCount += 1;

          // Track material costs for overall average
          if (!materialCosts[matName]) {
            materialCosts[matName] = {
              materialName: matName,
              costs: [],
              quantities: [],
            };
          }
          if (material.unitCost) {
            materialCosts[matName].costs.push(material.unitCost);
            materialCosts[matName].quantities.push(material.quantity || 0);
          }
        });
      } else {
        // Single material order
        const matName = po.materialName || 'Unknown';
        
        if (materialName && !matName.toLowerCase().includes(materialName.toLowerCase())) {
          return;
        }

        if (!trendsMap[period]) {
          trendsMap[period] = {};
        }

        if (!trendsMap[period][matName]) {
          trendsMap[period][matName] = {
            materialName: matName,
            totalQuantity: 0,
            totalCost: 0,
            averageUnitCost: 0,
            orderCount: 0,
          };
        }

        const trend = trendsMap[period][matName];
        trend.totalQuantity += po.quantityOrdered || 0;
        trend.totalCost += po.totalCost || 0;
        trend.orderCount += 1;

        if (!materialCosts[matName]) {
          materialCosts[matName] = {
            materialName: matName,
            costs: [],
            quantities: [],
          };
        }
        if (po.unitCost) {
          materialCosts[matName].costs.push(po.unitCost);
          materialCosts[matName].quantities.push(po.quantityOrdered || 0);
        }
      }
    });

    // Calculate average unit costs
    Object.keys(trendsMap).forEach((period) => {
      Object.keys(trendsMap[period]).forEach((matName) => {
        const trend = trendsMap[period][matName];
        trend.averageUnitCost =
          trend.totalQuantity > 0
            ? Math.round((trend.totalCost / trend.totalQuantity) * 100) / 100
            : 0;
      });
    });

    // Convert to array format
    const trends = Object.keys(trendsMap)
      .sort()
      .map((period) => ({
        period,
        materials: Object.values(trendsMap[period]),
      }));

    // Calculate overall material cost averages
    const materialAverages = Object.keys(materialCosts).map((matName) => {
      const mat = materialCosts[matName];
      const totalCost = mat.costs.reduce((sum, cost, idx) => sum + cost * (mat.quantities[idx] || 0), 0);
      const totalQuantity = mat.quantities.reduce((sum, qty) => sum + qty, 0);
      const averageUnitCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

      return {
        materialName: matName,
        averageUnitCost: Math.round(averageUnitCost * 100) / 100,
        minUnitCost: mat.costs.length > 0 ? Math.min(...mat.costs) : 0,
        maxUnitCost: mat.costs.length > 0 ? Math.max(...mat.costs) : 0,
        dataPoints: mat.costs.length,
      };
    });

    return successResponse({
      trends,
      materialAverages,
    });
  } catch (error) {
    console.error('Material cost trends error:', error);
    return errorResponse('Failed to retrieve material cost trends', 500);
  }
}


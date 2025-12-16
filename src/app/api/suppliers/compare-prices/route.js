/**
 * Price Comparison API Route
 * POST: Compare prices across suppliers for given materials
 * 
 * POST /api/suppliers/compare-prices
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/suppliers/compare-prices
 * Compares prices across suppliers for given materials
 * 
 * Request Body:
 * {
 *   materials: [
 *     {
 *       materialRequestId: ObjectId (optional),
 *       name: String (required),
 *       quantity: Number (required),
 *       unit: String (required),
 *       categoryId: ObjectId (optional)
 *     }
 *   ]
 * }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCompare = await hasPermission(user.id, 'view_purchase_orders');
    if (!canCompare) {
      return errorResponse(
        'Insufficient permissions. Only PM and OWNER can compare prices.',
        403
      );
    }

    const body = await request.json();
    const { materials } = body;

    if (!Array.isArray(materials) || materials.length === 0) {
      return errorResponse('At least one material is required', 400);
    }

    // Validate materials
    for (const material of materials) {
      if (!material.name || !material.quantity || !material.unit) {
        return errorResponse('Each material must have name, quantity, and unit', 400);
      }
    }

    const db = await getDatabase();

    // Get all active suppliers
    const suppliers = await db
      .collection('suppliers')
      .find({
        status: 'active',
        deletedAt: null,
      })
      .toArray();

    if (suppliers.length === 0) {
      return successResponse({
        comparisons: [],
        message: 'No active suppliers found',
      });
    }

    // For each supplier, get historical prices for similar materials
    const comparisons = [];

    for (const supplier of suppliers) {
      const supplierId = supplier._id;
      const supplierComparison = {
        supplierId: supplierId,
        supplierName: supplier.name || supplier.contactPerson || 'Unknown Supplier',
        supplierEmail: supplier.email || '',
        supplierPhone: supplier.phone || '',
        materials: [],
        totalEstimatedCost: 0,
        hasHistoricalData: false,
      };

      let totalCost = 0;
      let hasData = false;

      for (const material of materials) {
        const materialName = material.name.toLowerCase().trim();
        const materialUnit = material.unit.toLowerCase().trim();

        // Search for historical purchase orders with similar material name
        // Look for exact matches first, then partial matches
        const historicalPOs = await db
          .collection('purchase_orders')
          .find({
            supplierId: supplierId,
            deletedAt: null,
            status: { $in: ['order_accepted', 'ready_for_delivery', 'delivered'] },
            $or: [
              { materialName: { $regex: new RegExp(materialName, 'i') } },
              { 'materials.materialName': { $regex: new RegExp(materialName, 'i') } },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray();

        let estimatedUnitCost = null;
        let estimatedTotalCost = 0;
        let confidence = 'low'; // 'low', 'medium', 'high'
        let historicalData = null;

        if (historicalPOs.length > 0) {
          hasData = true;

          // Extract unit costs from historical POs
          const unitCosts = [];

          historicalPOs.forEach((po) => {
            // Handle bulk orders with materials array
            if (po.materials && Array.isArray(po.materials)) {
              po.materials.forEach((mat) => {
                const matName = (mat.materialName || '').toLowerCase().trim();
                if (matName.includes(materialName) || materialName.includes(matName)) {
                  if (mat.unitCost && mat.unitCost > 0) {
                    unitCosts.push(mat.unitCost);
                  }
                }
              });
            } else {
              // Single material order
              const poName = (po.materialName || '').toLowerCase().trim();
              if (poName.includes(materialName) || materialName.includes(poName)) {
                if (po.unitCost && po.unitCost > 0) {
                  unitCosts.push(po.unitCost);
                }
              }
            }
          });

          if (unitCosts.length > 0) {
            // Calculate average, giving more weight to recent orders
            const sortedCosts = unitCosts.sort((a, b) => b - a); // Sort descending
            const recentCosts = sortedCosts.slice(0, 3); // Take top 3 most recent
            const averageCost =
              recentCosts.reduce((sum, cost) => sum + cost, 0) / recentCosts.length;

            estimatedUnitCost = Math.round(averageCost * 100) / 100;
            estimatedTotalCost = Math.round(estimatedUnitCost * material.quantity * 100) / 100;
            totalCost += estimatedTotalCost;

            // Determine confidence based on data points
            if (unitCosts.length >= 5) {
              confidence = 'high';
            } else if (unitCosts.length >= 2) {
              confidence = 'medium';
            }

            historicalData = {
              dataPoints: unitCosts.length,
              averageUnitCost: estimatedUnitCost,
              minUnitCost: Math.min(...unitCosts),
              maxUnitCost: Math.max(...unitCosts),
              lastOrderDate: historicalPOs[0].createdAt,
            };
          }
        }

        // If no historical data, use estimated cost from material request if available
        if (!estimatedUnitCost && material.estimatedUnitCost) {
          estimatedUnitCost = material.estimatedUnitCost;
          estimatedTotalCost = Math.round(estimatedUnitCost * material.quantity * 100) / 100;
          totalCost += estimatedTotalCost;
          confidence = 'low';
        }

        supplierComparison.materials.push({
          materialRequestId: material.materialRequestId || null,
          materialName: material.name,
          quantity: material.quantity,
          unit: material.unit,
          estimatedUnitCost: estimatedUnitCost,
          estimatedTotalCost: estimatedTotalCost,
          confidence: confidence,
          historicalData: historicalData,
        });
      }

      supplierComparison.totalEstimatedCost = Math.round(totalCost * 100) / 100;
      supplierComparison.hasHistoricalData = hasData;

      comparisons.push(supplierComparison);
    }

    // Sort by total estimated cost (ascending - cheapest first)
    comparisons.sort((a, b) => {
      // Prioritize suppliers with historical data
      if (a.hasHistoricalData && !b.hasHistoricalData) return -1;
      if (!a.hasHistoricalData && b.hasHistoricalData) return 1;
      // Then sort by cost
      return a.totalEstimatedCost - b.totalEstimatedCost;
    });

    return successResponse({
      comparisons,
      summary: {
        totalSuppliers: comparisons.length,
        suppliersWithData: comparisons.filter((c) => c.hasHistoricalData).length,
        cheapestSupplier: comparisons.length > 0 ? comparisons[0].supplierName : null,
        cheapestTotal: comparisons.length > 0 ? comparisons[0].totalEstimatedCost : 0,
      },
    });
  } catch (error) {
    console.error('Price comparison error:', error);
    return errorResponse('Failed to compare prices', 500);
  }
}


/**
 * Phase Resources Report API Route
 * Returns detailed resource report data for a phase
 * 
 * GET /api/phases/[id]/reports/resources
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getPhaseEquipmentStatistics } from '@/lib/equipment-helpers';
import { getPhaseSubcontractorStatistics, calculatePhaseSubcontractorCost } from '@/lib/subcontractor-helpers';

/**
 * GET /api/phases/[id]/reports/resources
 * Returns detailed resource report data
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
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
      return errorResponse('Invalid phase ID', 400);
    }

    const db = await getDatabase();
    
    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });
    
    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Get equipment statistics
    const equipmentStats = await getPhaseEquipmentStatistics(id);
    
    // Get equipment details
    const equipment = await db.collection('equipment').find({
      phaseId: new ObjectId(id),
      deletedAt: null
    }).toArray();

    // Get equipment utilization breakdown
    const equipmentUtilization = equipment.map(eq => ({
      _id: eq._id,
      equipmentName: eq.equipmentName,
      equipmentType: eq.equipmentType,
      acquisitionType: eq.acquisitionType,
      status: eq.status,
      dailyRate: eq.dailyRate || 0,
      totalCost: eq.totalCost || 0,
      utilization: eq.utilization || {
        estimatedHours: 0,
        actualHours: 0,
        utilizationPercentage: 0
      },
      startDate: eq.startDate,
      endDate: eq.endDate
    }));

    // Get subcontractor statistics
    const subcontractorStats = await getPhaseSubcontractorStatistics(id);
    
    // Get subcontractor details
    const subcontractors = await db.collection('subcontractors').find({
      phaseId: new ObjectId(id),
      deletedAt: null
    }).toArray();

    // Get subcontractor performance breakdown
    const { calculateTotalPaid, calculateTotalUnpaid } = await import('@/lib/schemas/subcontractor-schema');
    const subcontractorPerformance = subcontractors.map(sub => {
      const totalPayments = sub.paymentSchedule && Array.isArray(sub.paymentSchedule) 
        ? calculateTotalPaid(sub.paymentSchedule) 
        : 0;
      const pendingPayments = sub.paymentSchedule && Array.isArray(sub.paymentSchedule)
        ? calculateTotalUnpaid(sub.paymentSchedule)
        : 0;
      const avgPerformance = sub.performance 
        ? ((sub.performance.quality || 0) + (sub.performance.timeliness || 0) + (sub.performance.communication || 0)) / 3
        : 0;

      return {
        _id: sub._id,
        subcontractorName: sub.subcontractorName,
        subcontractorType: sub.subcontractorType,
        contractValue: sub.contractValue || 0,
        contractType: sub.contractType,
        status: sub.status,
        totalPaid: totalPayments,
        pendingPayments: pendingPayments,
        paymentProgress: sub.contractValue > 0 
          ? ((totalPayments / sub.contractValue) * 100).toFixed(2)
          : 0,
        performance: {
          quality: sub.performance?.quality || 0,
          timeliness: sub.performance?.timeliness || 0,
          communication: sub.performance?.communication || 0,
          average: avgPerformance.toFixed(2)
        },
        startDate: sub.startDate,
        endDate: sub.endDate
      };
    });

    // Get professional services
    const professionalServices = await db.collection('professional_services').find({
      phaseId: new ObjectId(id),
      deletedAt: null
    }).toArray();

    const professionalServicesBreakdown = professionalServices.map(ps => ({
      _id: ps._id,
      serviceName: ps.serviceName || ps.activityName,
      serviceType: ps.serviceType,
      providerName: ps.providerName,
      totalFees: ps.totalFees || 0,
      status: ps.status,
      startDate: ps.startDate,
      endDate: ps.endDate
    }));

    // Calculate resource costs
    const totalEquipmentCost = equipment.reduce((sum, eq) => sum + (eq.totalCost || 0), 0);
    const totalSubcontractorCost = await calculatePhaseSubcontractorCost(id);
    const totalProfessionalServicesCost = professionalServices.reduce((sum, ps) => sum + (ps.totalFees || 0), 0);

    // Calculate utilization rates
    const equipmentUtilizationRate = equipment.length > 0
      ? equipment.reduce((sum, eq) => sum + (eq.utilization?.utilizationPercentage || 0), 0) / equipment.length
      : 0;

    return successResponse({
      phase: {
        _id: phase._id,
        phaseName: phase.phaseName,
        phaseCode: phase.phaseCode
      },
      summary: {
        totalEquipment: equipment.length,
        totalSubcontractors: subcontractors.length,
        totalProfessionalServices: professionalServices.length,
        totalResourceCost: totalEquipmentCost + totalSubcontractorCost + totalProfessionalServicesCost
      },
      equipment: {
        statistics: equipmentStats,
        items: equipmentUtilization,
        totalCost: totalEquipmentCost,
        averageUtilization: equipmentUtilizationRate.toFixed(2)
      },
      subcontractors: {
        statistics: subcontractorStats,
        items: subcontractorPerformance,
        totalCost: totalSubcontractorCost,
        totalContractValue: subcontractors.reduce((sum, sub) => sum + (sub.contractValue || 0), 0),
        averagePerformance: subcontractorPerformance.length > 0
          ? (subcontractorPerformance.reduce((sum, sub) => sum + parseFloat(sub.performance.average), 0) / subcontractorPerformance.length).toFixed(2)
          : 0
      },
      professionalServices: {
        items: professionalServicesBreakdown,
        totalCost: totalProfessionalServicesCost,
        byType: professionalServicesBreakdown.reduce((acc, ps) => {
          const type = ps.serviceType || 'Other';
          if (!acc[type]) {
            acc[type] = { count: 0, totalCost: 0 };
          }
          acc[type].count++;
          acc[type].totalCost += ps.totalFees || 0;
          return acc;
        }, {})
      },
      costBreakdown: {
        equipment: {
          total: totalEquipmentCost,
          percentage: (totalEquipmentCost + totalSubcontractorCost + totalProfessionalServicesCost) > 0
            ? ((totalEquipmentCost / (totalEquipmentCost + totalSubcontractorCost + totalProfessionalServicesCost)) * 100).toFixed(2)
            : 0
        },
        subcontractors: {
          total: totalSubcontractorCost,
          percentage: (totalEquipmentCost + totalSubcontractorCost + totalProfessionalServicesCost) > 0
            ? ((totalSubcontractorCost / (totalEquipmentCost + totalSubcontractorCost + totalProfessionalServicesCost)) * 100).toFixed(2)
            : 0
        },
        professionalServices: {
          total: totalProfessionalServicesCost,
          percentage: (totalEquipmentCost + totalSubcontractorCost + totalProfessionalServicesCost) > 0
            ? ((totalProfessionalServicesCost / (totalEquipmentCost + totalSubcontractorCost + totalProfessionalServicesCost)) * 100).toFixed(2)
            : 0
        }
      }
    }, 'Resource report data retrieved successfully');
  } catch (error) {
    console.error('Get resource report error:', error);
    return errorResponse('Failed to retrieve resource report', 500);
  }
}


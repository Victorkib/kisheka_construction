/**
 * Suppliers API Route
 * GET: List all suppliers with filtering and pagination
 * POST: Create new supplier
 * 
 * GET /api/suppliers
 * POST /api/suppliers
 * Auth: OWNER, PM only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/suppliers
 * Returns suppliers with filtering, sorting, and pagination
 * Query params: status, search, specialty, page, limit
 * Auth: OWNER, PM only
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_suppliers');
    if (!canView) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can view suppliers.', 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const specialty = searchParams.get('specialty');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const db = await getDatabase();
    const query = { deletedAt: null };

    // Status filter
    if (status) {
      query.status = status;
    }

    // Search filter (name or email)
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { contactPerson: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Specialty filter
    if (specialty) {
      query.specialties = specialty;
    }

    const skip = (page - 1) * limit;
    
    // Get suppliers
    const suppliers = await db.collection('suppliers')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await db.collection('suppliers').countDocuments(query);

    return successResponse({
      suppliers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Suppliers retrieved successfully');
  } catch (error) {
    console.error('Get suppliers error:', error);
    return errorResponse('Failed to retrieve suppliers', 500);
  }
}

/**
 * POST /api/suppliers
 * Creates a new supplier
 * Auth: OWNER, PM only
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_supplier');
    if (!canCreate) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can create suppliers.', 403);
    }

    const body = await request.json();
    const {
      name,
      contactPerson,
      email,
      phone,
      alternatePhone,
      alternateEmail,
      businessType,
      taxId,
      address,
      preferredContactMethod,
      emailEnabled,
      smsEnabled,
      pushNotificationsEnabled,
      languagePreference, // 'en', 'sw', or 'both' - defaults to 'en'
      specialties,
      rating,
      notes,
      status
    } = body;

    // Validation
    if (!name || !name.trim()) {
      return errorResponse('Supplier name is required', 400);
    }

    if (!email || !email.trim()) {
      return errorResponse('Supplier email is required', 400);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return errorResponse('Invalid email format', 400);
    }

    if (!phone || !phone.trim()) {
      return errorResponse('Supplier phone number is required', 400);
    }

    const db = await getDatabase();

    // Check if email already exists
    const existing = await db.collection('suppliers').findOne({
      email: email.toLowerCase().trim(),
      deletedAt: null
    });

    if (existing) {
      return errorResponse('Supplier with this email already exists', 409);
    }

    // Build supplier document
    const supplier = {
      name: name.trim(),
      contactPerson: contactPerson?.trim() || null,
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      alternatePhone: alternatePhone?.trim() || null,
      alternateEmail: alternateEmail?.toLowerCase().trim() || null,
      businessType: businessType || null,
      taxId: taxId?.trim() || null,
      address: address || null,
      preferredContactMethod: preferredContactMethod || 'all',
      emailEnabled: emailEnabled !== false, // Default to true
      smsEnabled: smsEnabled !== false, // Default to true
      pushNotificationsEnabled: pushNotificationsEnabled !== false, // Default to true
      languagePreference: languagePreference && ['en', 'sw', 'both'].includes(languagePreference) ? languagePreference : 'en', // Default to English
      specialties: Array.isArray(specialties) ? specialties : [],
      rating: rating || null,
      notes: notes?.trim() || null,
      status: status || 'active',
      createdBy: new ObjectId(userProfile._id),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };

    const result = await db.collection('suppliers').insertOne(supplier);

    return successResponse(
      { ...supplier, _id: result.insertedId },
      'Supplier created successfully',
      201
    );
  } catch (error) {
    console.error('Create supplier error:', error);
    return errorResponse('Failed to create supplier', 500);
  }
}


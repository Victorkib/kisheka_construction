/**
 * Invitation Verification API Route
 * GET: Verify invitation token and return invitation details
 * 
 * GET /api/users/invitations/[token]
 * Public endpoint (no auth required)
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/users/invitations/[token]
 * Verifies invitation token and returns invitation details
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return errorResponse('Invalid invitation token', 400);
    }

    const db = await getDatabase();

    // Find invitation by token
    const invitation = await db.collection('invitations').findOne({
      token,
      status: 'pending',
    });

    if (!invitation) {
      return errorResponse('Invitation not found or already used', 404);
    }

    // Check if invitation has expired
    if (new Date() > new Date(invitation.expiresAt)) {
      // Mark as expired
      await db.collection('invitations').updateOne(
        { _id: invitation._id },
        { $set: { status: 'expired', updatedAt: new Date() } }
      );
      return errorResponse('This invitation has expired', 410);
    }

    // Check if user already exists (double-check)
    const existingUser = await db.collection('users').findOne({
      email: invitation.email,
    });

    if (existingUser) {
      // Mark invitation as used
      await db.collection('invitations').updateOne(
        { _id: invitation._id },
        { $set: { status: 'used', updatedAt: new Date() } }
      );
      return errorResponse('User with this email already exists', 409);
    }

    // Return invitation details (without sensitive info)
    return successResponse({
      email: invitation.email,
      role: invitation.role,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      invitedBy: invitation.inviterName,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error('Error verifying invitation:', error);
    return errorResponse('Failed to verify invitation', 500);
  }
}

/**
 * POST /api/users/invitations/[token]/accept
 * Marks invitation as accepted (called after successful registration)
 */
export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!token || !userId) {
      return errorResponse('Token and userId are required', 400);
    }

    const db = await getDatabase();

    // Find and update invitation
    const invitation = await db.collection('invitations').findOne({
      token,
      status: 'pending',
    });

    if (!invitation) {
      return errorResponse('Invitation not found or already used', 404);
    }

    // Mark invitation as accepted
    await db.collection('invitations').updateOne(
      { _id: invitation._id },
      {
        $set: {
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedBy: userId,
          updatedAt: new Date(),
        },
      }
    );

    return successResponse(null, 'Invitation accepted');
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return errorResponse('Failed to accept invitation', 500);
  }
}




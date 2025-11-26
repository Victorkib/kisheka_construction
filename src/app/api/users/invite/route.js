/**
 * User Invitation API Route
 * POST: Create and send user invitation
 * 
 * POST /api/users/invite
 * Auth: OWNER only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { normalizeRole } from '@/lib/role-normalizer';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { sendInvitationEmail } from '@/lib/email-service';
import { createAuditLog } from '@/lib/audit-log';
import crypto from 'crypto';

import { VALID_ROLES } from '@/lib/role-constants';

/**
 * Generate secure invitation token
 */
function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/users/invite
 * Creates and sends user invitation
 * Auth: OWNER only
 * Body: { email, role, firstName?, lastName? }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canInvite = await hasPermission(user.id, 'invite_users');
    if (!canInvite) {
      return errorResponse('Permission denied. Only OWNER can invite users.', 403);
    }

    const inviterProfile = await getUserProfile(user.id);
    if (!inviterProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const { email, role, firstName, lastName } = body;

    // Validation
    if (!email || !email.includes('@')) {
      return errorResponse('Valid email is required', 400);
    }

    if (!role || !VALID_ROLES.includes(role.toLowerCase())) {
      return errorResponse(`Valid role is required. Valid roles: ${VALID_ROLES.join(', ')}`, 400);
    }

    // Prevent inviting as owner (security measure)
    if (role.toLowerCase() === 'owner') {
      return errorResponse('Cannot invite users as owner. Owner role must be assigned manually.', 403);
    }

    const db = await getDatabase();
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedRole = normalizeRole(role);

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email: normalizedEmail });
    if (existingUser) {
      return errorResponse('User with this email already exists in the system', 409);
    }

    // Check if there's a pending invitation for this email
    const existingInvitation = await db.collection('invitations').findOne({
      email: normalizedEmail,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (existingInvitation) {
      return errorResponse('An active invitation already exists for this email', 409);
    }

    // Generate invitation token
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Create invitation record
    const invitation = {
      email: normalizedEmail,
      role: normalizedRole,
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      token,
      status: 'pending',
      invitedBy: user.id,
      inviterName: `${inviterProfile.firstName || ''} ${inviterProfile.lastName || ''}`.trim() || inviterProfile.email,
      createdAt: new Date(),
      expiresAt,
      acceptedAt: null,
    };

    const result = await db.collection('invitations').insertOne(invitation);

    // Send invitation email
    try {
      await sendInvitationEmail({
        email: normalizedEmail,
        inviterName: invitation.inviterName,
        role: normalizedRole,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      // Update invitation with sent status
      await db.collection('invitations').updateOne(
        { _id: result.insertedId },
        { $set: { emailSent: true, emailSentAt: new Date() } }
      );

      // Create audit log
      try {
        await createAuditLog({
          userId: inviterProfile._id?.toString() || user.id,
          action: 'INVITATION_SENT',
          entityType: 'USER',
          entityId: result.insertedId.toString(),
          changes: {
            email: normalizedEmail,
            role: normalizedRole,
          },
          status: 'SUCCESS',
        });
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError);
      }
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the request if email fails, but log it
      // The invitation is still created and can be resent
    }

    return successResponse(
      {
        invitationId: result.insertedId.toString(),
        email: normalizedEmail,
        role: normalizedRole,
        expiresAt: expiresAt.toISOString(),
      },
      'Invitation sent successfully',
      201
    );
  } catch (error) {
    console.error('Error creating invitation:', error);
    return errorResponse('Failed to create invitation', 500);
  }
}




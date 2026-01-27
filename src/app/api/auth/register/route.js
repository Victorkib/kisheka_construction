/**
 * Registration API Route
 * Creates new user account in Supabase and MongoDB
 * POST /api/auth/register
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { syncUserToMongoDB } from '@/lib/auth-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request) {
  try {
    const { email, password, firstName, lastName, invitationToken } =
      await request.json();

    if (!email || !password) {
      return errorResponse('Email and password required', 400);
    }

    if (password.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400);
    }

    const db = await getDatabase();
    const normalizedEmail = email.toLowerCase().trim();
    let invitation = null;
    let assignedRole = 'owner'; // Default role

    // If invitation token is provided, verify it
    if (invitationToken) {
      invitation = await db.collection('invitations').findOne({
        token: invitationToken,
        status: 'pending',
        email: normalizedEmail,
      });

      if (!invitation) {
        return errorResponse('Invalid or expired invitation token', 400);
      }

      // Check if invitation has expired
      if (new Date() > new Date(invitation.expiresAt)) {
        await db
          .collection('invitations')
          .updateOne(
            { _id: invitation._id },
            { $set: { status: 'expired', updatedAt: new Date() } },
          );
        return errorResponse('This invitation has expired', 410);
      }

      // Use role from invitation
      assignedRole = invitation.role || 'owner';
    }

    // Check if user already exists
    const existingUser = await db
      .collection('users')
      .findOne({ email: normalizedEmail });
    if (existingUser) {
      return errorResponse('User with this email already exists', 409);
    }

    const supabase = await createClient();

    // Create user in Supabase
    const { data, error: signupError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          first_name: firstName || invitation?.firstName || '',
          last_name: lastName || invitation?.lastName || '',
        },
        // Set redirect URL for email verification
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback?type=signup`,
      },
    });

    if (signupError || !data.user) {
      return errorResponse(signupError?.message || 'Signup failed', 400);
    }

    // Sync user to MongoDB with invitation role if applicable
    await syncUserToMongoDB(data.user, {
      firstName: firstName || invitation?.firstName || '',
      lastName: lastName || invitation?.lastName || '',
      role: assignedRole,
    });

    // If invitation was used, mark it as accepted
    if (invitation) {
      await db.collection('invitations').updateOne(
        { _id: invitation._id },
        {
          $set: {
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedBy: data.user.id,
            updatedAt: new Date(),
          },
        },
      );

      // Log role assignment from invitation
      const userProfile = await db
        .collection('users')
        .findOne({ supabaseId: data.user.id });
      if (userProfile) {
        await db.collection('role_changes').insertOne({
          userId: userProfile._id,
          oldRole: null,
          newRole: assignedRole,
          changedBy: invitation.invitedBy,
          reason: 'Role assigned via invitation',
          timestamp: new Date(),
        });
      }
    }

    return successResponse(
      { userId: data.user.id },
      invitation
        ? 'Account created successfully. You can now log in.'
        : 'Account created. Check your email to confirm.',
      201,
    );
  } catch (error) {
    console.error('Register error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * Project Team Management API Route
 * GET: Get project team members
 * POST: Add team member to project
 * DELETE: Remove team member from project
 * PATCH: Update team member role/permissions
 * 
 * GET/POST/DELETE/PATCH /api/projects/[id]/team
 * Auth: OWNER, PM (for their projects)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateProjectAccess } from '@/lib/middleware/project-context';

/**
 * GET /api/projects/[id]/team
 * Returns all team members for a project
 */
export async function GET(request, { params }) {
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

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    // Validate project access
    const accessResult = await validateProjectAccess(userProfile._id, id);
    if (!accessResult.hasAccess) {
      return errorResponse(accessResult.error || 'Access denied to this project', 403);
    }

    const db = await getDatabase();
    const projectId = new ObjectId(id);

    // Get all active memberships for this project
    const memberships = await db
      .collection('project_memberships')
      .find({
        projectId: projectId,
        status: 'active',
      })
      .sort({ joinedAt: 1 })
      .toArray();

    // Get user details for each membership
    const userIds = memberships.map((m) => m.userId);
    const users = await db
      .collection('users')
      .find({
        _id: { $in: userIds },
      })
      .toArray();

    // Combine memberships with user data
    const teamMembers = memberships.map((membership) => {
      const user = users.find((u) => u._id.toString() === membership.userId.toString());
      return {
        membershipId: membership._id,
        userId: membership.userId,
        role: membership.role,
        permissions: membership.permissions || [],
        joinedAt: membership.joinedAt,
        user: user
          ? {
              _id: user._id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              role: user.role, // Global role
            }
          : null,
      };
    });

    return successResponse({
      projectId: id,
      teamMembers,
      totalMembers: teamMembers.length,
    });
  } catch (error) {
    console.error('Get project team error:', error);
    return errorResponse('Failed to retrieve project team', 500);
  }
}

/**
 * POST /api/projects/[id]/team
 * Adds a team member to a project
 */
export async function POST(request, { params }) {
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

    // Check permission - only OWNER and PM can manage teams
    const canManage = await hasPermission(user.id, 'manage_project_team');
    if (!canManage) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can manage project teams.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    // Validate project access
    const accessResult = await validateProjectAccess(userProfile._id, id);
    if (!accessResult.hasAccess) {
      return errorResponse(accessResult.error || 'Access denied to this project', 403);
    }

    const body = await request.json();
    const { userId, role, permissions = [] } = body;

    if (!userId || !ObjectId.isValid(userId)) {
      return errorResponse('Valid user ID is required', 400);
    }

    if (!role) {
      return errorResponse('Role is required', 400);
    }

    const validRoles = ['owner', 'pm', 'supervisor', 'site_clerk', 'accountant', 'investor', 'viewer'];
    if (!validRoles.includes(role.toLowerCase())) {
      return errorResponse(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
    }

    const db = await getDatabase();
    const projectId = new ObjectId(id);
    const targetUserId = new ObjectId(userId);

    // Check if user exists
    const targetUser = await db.collection('users').findOne({ _id: targetUserId });
    if (!targetUser) {
      return errorResponse('User not found', 404);
    }

    // Check if project exists
    const project = await db.collection('projects').findOne({
      _id: projectId,
      deletedAt: null,
    });
    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Check if membership already exists
    const existingMembership = await db.collection('project_memberships').findOne({
      userId: targetUserId,
      projectId: projectId,
    });

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        return errorResponse('User is already a member of this project', 400);
      } else {
        // Reactivate existing membership
        await db.collection('project_memberships').updateOne(
          { _id: existingMembership._id },
          {
            $set: {
              role: role.toLowerCase(),
              permissions: permissions,
              status: 'active',
              removedAt: null,
              updatedAt: new Date(),
            },
          }
        );

        const updatedMembership = await db.collection('project_memberships').findOne({
          _id: existingMembership._id,
        });

        // Create audit log
        await createAuditLog({
          userId: userProfile._id.toString(),
          action: 'UPDATED',
          entityType: 'PROJECT_MEMBERSHIP',
          entityId: updatedMembership._id.toString(),
          projectId: id,
          changes: {
            status: { oldValue: 'inactive', newValue: 'active' },
            role: { oldValue: existingMembership.role, newValue: role },
          },
        });

        return successResponse(
          {
            membership: updatedMembership,
            message: 'Team member reactivated successfully',
          },
          'Team member added successfully'
        );
      }
    }

    // Create new membership
    const membership = {
      userId: targetUserId,
      projectId: projectId,
      role: role.toLowerCase(),
      permissions: permissions,
      joinedAt: new Date(),
      removedAt: null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('project_memberships').insertOne(membership);
    const insertedMembership = { ...membership, _id: result.insertedId };

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PROJECT_MEMBERSHIP',
      entityId: insertedMembership._id.toString(),
      projectId: id,
      changes: {
        created: {
          userId: userId,
          role: role,
          permissions: permissions,
        },
      },
    });

    return successResponse(
      {
        membership: insertedMembership,
        message: 'Team member added successfully',
      },
      'Team member added successfully',
      201
    );
  } catch (error) {
    console.error('Add team member error:', error);
    return errorResponse('Failed to add team member', 500);
  }
}

/**
 * PATCH /api/projects/[id]/team
 * Updates a team member's role or permissions
 */
export async function PATCH(request, { params }) {
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
    const canManage = await hasPermission(user.id, 'manage_project_team');
    if (!canManage) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can manage project teams.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    // Validate project access
    const accessResult = await validateProjectAccess(userProfile._id, id);
    if (!accessResult.hasAccess) {
      return errorResponse(accessResult.error || 'Access denied to this project', 403);
    }

    const body = await request.json();
    const { membershipId, role, permissions } = body;

    if (!membershipId || !ObjectId.isValid(membershipId)) {
      return errorResponse('Valid membership ID is required', 400);
    }

    const db = await getDatabase();
    const projectId = new ObjectId(id);

    // Get existing membership
    const existingMembership = await db.collection('project_memberships').findOne({
      _id: new ObjectId(membershipId),
      projectId: projectId,
    });

    if (!existingMembership) {
      return errorResponse('Membership not found', 404);
    }

    // Build update
    const updateData = {
      updatedAt: new Date(),
    };

    if (role) {
      const validRoles = ['owner', 'pm', 'supervisor', 'site_clerk', 'accountant', 'investor', 'viewer'];
      if (!validRoles.includes(role.toLowerCase())) {
        return errorResponse(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
      }
      updateData.role = role.toLowerCase();
    }

    if (permissions !== undefined) {
      updateData.permissions = Array.isArray(permissions) ? permissions : [];
    }

    // Update membership
    await db.collection('project_memberships').updateOne(
      { _id: new ObjectId(membershipId) },
      { $set: updateData }
    );

    const updatedMembership = await db.collection('project_memberships').findOne({
      _id: new ObjectId(membershipId),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'PROJECT_MEMBERSHIP',
      entityId: membershipId,
      projectId: id,
      changes: {
        role: role ? { oldValue: existingMembership.role, newValue: role } : undefined,
        permissions: permissions !== undefined
          ? { oldValue: existingMembership.permissions, newValue: permissions }
          : undefined,
      },
    });

    return successResponse(
      {
        membership: updatedMembership,
        message: 'Team member updated successfully',
      },
      'Team member updated successfully'
    );
  } catch (error) {
    console.error('Update team member error:', error);
    return errorResponse('Failed to update team member', 500);
  }
}

/**
 * DELETE /api/projects/[id]/team
 * Removes a team member from a project
 */
export async function DELETE(request, { params }) {
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
    const canManage = await hasPermission(user.id, 'manage_project_team');
    if (!canManage) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can manage project teams.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    // Validate project access
    const accessResult = await validateProjectAccess(userProfile._id, id);
    if (!accessResult.hasAccess) {
      return errorResponse(accessResult.error || 'Access denied to this project', 403);
    }

    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get('membershipId');

    if (!membershipId || !ObjectId.isValid(membershipId)) {
      return errorResponse('Valid membership ID is required', 400);
    }

    const db = await getDatabase();
    const projectId = new ObjectId(id);

    // Get existing membership
    const existingMembership = await db.collection('project_memberships').findOne({
      _id: new ObjectId(membershipId),
      projectId: projectId,
    });

    if (!existingMembership) {
      return errorResponse('Membership not found', 404);
    }

    // Soft delete (set status to inactive)
    await db.collection('project_memberships').updateOne(
      { _id: new ObjectId(membershipId) },
      {
        $set: {
          status: 'inactive',
          removedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'PROJECT_MEMBERSHIP',
      entityId: membershipId,
      projectId: id,
      changes: {
        status: { oldValue: 'active', newValue: 'inactive' },
        removedAt: { oldValue: null, newValue: new Date() },
      },
    });

    return successResponse(
      {
        message: 'Team member removed successfully',
      },
      'Team member removed successfully'
    );
  } catch (error) {
    console.error('Remove team member error:', error);
    return errorResponse('Failed to remove team member', 500);
  }
}








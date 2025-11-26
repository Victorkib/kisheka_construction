/**
 * Authentication Helper Functions
 * Utilities for user authentication and authorization
 */

import { createClient } from './supabase/server';
import { getDatabase } from './mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Gets the current authenticated user from Supabase session
 * @param {import('next/headers').cookies} cookieStore - Next.js cookies store
 * @returns {Promise<{user: import('@supabase/supabase-js').User | null, error: Error | null}>}
 */
export async function getCurrentUser(cookieStore) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null, error: error || new Error('No user found') };
    }

    return { user, error: null };
  } catch (error) {
    console.error('Error getting current user:', error);
    return { user: null, error };
  }
}

/**
 * Gets the full user profile from MongoDB using Supabase user ID
 * @param {string} supabaseId - Supabase user ID
 * @returns {Promise<Object | null>} User profile from MongoDB or null if not found
 */
export async function getUserProfile(supabaseId) {
  try {
    const db = await getDatabase();
    const userProfile = await db.collection('users').findOne({
      supabaseId:supabaseId,
    });

    return userProfile;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

/**
 * Creates or updates user profile in MongoDB after Supabase authentication
 * @param {import('@supabase/supabase-js').User} supabaseUser - Authenticated Supabase user
 * @param {Object} [additionalData] - Additional user data to store
 * @returns {Promise<Object>} Created or updated user profile
 */
export async function syncUserToMongoDB(supabaseUser, additionalData = {}) {
  try {
    const db = await getDatabase();

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({
      supabaseId: supabaseUser.id,
    });

    // Extract name from various OAuth provider formats
    let firstName = additionalData.firstName || '';
    let lastName = additionalData.lastName || '';

    // Try to extract from OAuth metadata (different providers use different fields)
    if (!firstName && !lastName) {
      const fullName = supabaseUser.user_metadata?.full_name || 
                      supabaseUser.user_metadata?.name || 
                      supabaseUser.user_metadata?.preferred_username || 
                      '';
      
      if (fullName) {
        const nameParts = fullName.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
    }

    // Fallback to Supabase metadata fields
    firstName = firstName || supabaseUser.user_metadata?.first_name || 
                supabaseUser.user_metadata?.given_name || '';
    lastName = lastName || supabaseUser.user_metadata?.last_name || 
               supabaseUser.user_metadata?.family_name || '';

    // Prepare user data - preserve existing role for existing users
    const userData = {
      supabaseId: supabaseUser.id,
      email: supabaseUser.email,
      firstName,
      lastName,
      status: 'active',
      updatedAt: new Date(),
      ...additionalData,
    };

    // Only set default role for NEW users, preserve existing role for existing users
    if (existingUser) {
      // For existing users: preserve current role unless explicitly provided in additionalData
      if (additionalData.hasOwnProperty('role') && additionalData.role !== undefined) {
        userData.role = additionalData.role; // Use provided role
      } else {
        userData.role = existingUser.role; // Preserve existing role
      }
      
      // Update existing user
      await db.collection('users').updateOne(
        { supabaseId: supabaseUser.id },
        {
          $set: {
            ...userData,
            lastLogin: new Date(),
          },
        }
      );
      return { ...existingUser, ...userData, lastLogin: new Date() };
    } else {
      // Create new user - set default role only for new users
      const newUser = {
        ...userData,
        role: additionalData.role || 'site_clerk', // Default role only for new users
        createdAt: new Date(),
        isVerified: supabaseUser.email_confirmed_at ? true : false,
        notificationPreferences: {
          emailNotifications: true,
          approvalAlerts: true,
          budgetAlerts: true,
          dailyReports: false,
        },
        metadata: {
          loginCount: 1,
          lastActivityAt: new Date(),
          failedLoginAttempts: 0,
        },
      };

      const result = await db.collection('users').insertOne(newUser);
      return { ...newUser, _id: result.insertedId };
    }
  } catch (error) {
    console.error('Error syncing user to MongoDB:', error);
    throw error;
  }
}

/**
 * Checks if user has required role
 * @param {string} supabaseId - Supabase user ID
 * @param {string | string[]} requiredRoles - Required role(s)
 * @returns {Promise<boolean>} True if user has required role
 */
export async function hasRole(supabaseId, requiredRoles) {
  try {
    const userProfile = await getUserProfile(supabaseId);
    if (!userProfile) return false;

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(userProfile.role);
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
}

/**
 * Gets user profile by MongoDB ObjectId
 * @param {string|ObjectId} userId - MongoDB user ObjectId
 * @returns {Promise<Object|null>} User profile with safe fields or null if not found
 */
export async function getUserById(userId) {
  try {
    if (!userId) return null;

    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(userId),
    });

    if (!user) return null;

    // Return safe user data (exclude sensitive fields)
    return {
      _id: user._id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role || '',
      status: user.status || 'active',
      // Exclude: password, supabaseId (internal), sensitive metadata
    };
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

/**
 * Gets project by MongoDB ObjectId
 * @param {string|ObjectId} projectId - MongoDB project ObjectId
 * @returns {Promise<Object|null>} Project or null if not found
 */
export async function getProjectById(projectId) {
  try {
    if (!projectId) return null;

    const db = await getDatabase();
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) return null;

    // Return essential project data
    return {
      _id: project._id,
      projectCode: project.projectCode || '',
      projectName: project.projectName || '',
      location: project.location || '',
      status: project.status || '',
    };
  } catch (error) {
    console.error('Error getting project by ID:', error);
    return null;
  }
}

/**
 * Middleware helper to verify authentication and optionally check roles
 * @param {import('next/server').NextRequest} request - Next.js request object
 * @param {string | string[]} [requiredRoles] - Optional required roles
 * @returns {Promise<{user: Object, profile: Object} | null>} User and profile if authenticated, null otherwise
 */
export async function verifyAuth(request, requiredRoles = null) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return null;
    }

    // Check role if required
    if (requiredRoles) {
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      if (!roles.includes(profile.role)) {
        return null;
      }
    }

    return { user, profile };
  } catch (error) {
    console.error('Error verifying auth:', error);
    return null;
  }
}


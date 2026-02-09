/**
 * Project Team Management Page
 * Allows managing team members for a project
 * 
 * Route: /projects/[id]/team
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useProjectContext } from '@/contexts/ProjectContext';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ConfirmationModal } from '@/components/modals';
import { normalizeProjectId, projectIdsMatch } from '@/lib/utils/project-id-helpers';

export default function ProjectTeamPage() {
  const params = useParams();
  const router = useRouter();
  const { currentProject, switchProject } = useProjectContext();
  const { user, canAccess } = usePermissions();
  const toast = useToast();

  const [teamMembers, setTeamMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedMembershipId, setSelectedMembershipId] = useState(null);
  const [newMember, setNewMember] = useState({
    userId: '',
    role: 'site_clerk',
    permissions: [],
  });

  // Get projectId from URL params or current project context
  const urlProjectId = normalizeProjectId(params?.id);
  const currentProjectId = normalizeProjectId(currentProject?._id);
  const projectId = urlProjectId || currentProjectId;

  // If URL has projectId but it's different from current project, switch to it
  useEffect(() => {
    if (urlProjectId && currentProject && !projectIdsMatch(urlProjectId, currentProjectId)) {
      switchProject(urlProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId, currentProjectId]);

  useEffect(() => {
    if (projectId) {
      fetchTeamMembers();
      fetchAllUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/team`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch team members');
      }

      setTeamMembers(data.data.teamMembers || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.showError(error.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (data.success) {
        setAllUsers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.userId) {
      toast.showError('Please select a user');
      return;
    }

    try {
      setAddingMember(true);
      const addResponse = await fetch(`/api/projects/${projectId}/team`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(newMember),
      });

      const data = await addResponse.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to add team member');
      }

      toast.showSuccess('Team member added successfully');
      setShowAddModal(false);
      setNewMember({ userId: '', role: 'site_clerk', permissions: [] });
      fetchTeamMembers();
    } catch (error) {
      console.error('Error adding team member:', error);
      toast.showError(error.message || 'Failed to add team member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMembershipId) {
      return;
    }

    try {
      setRemovingMemberId(selectedMembershipId);
      const removeResponse = await fetch(
        `/api/projects/${projectId}/team?membershipId=${selectedMembershipId}`,
        {
          method: 'DELETE',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }
      );

      const data = await removeResponse.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to remove team member');
      }

      toast.showSuccess('Team member removed successfully');
      setShowRemoveModal(false);
      setSelectedMembershipId(null);
      fetchTeamMembers();
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.showError(error.message || 'Failed to remove team member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleUpdateRole = async (membershipId, newRole) => {
    try {
      const updateResponse = await fetch(`/api/projects/${projectId}/team`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          membershipId,
          role: newRole,
        }),
      });

      const data = await updateResponse.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update role');
      }

      toast.showSuccess('Role updated successfully');
      fetchTeamMembers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.showError(error.message || 'Failed to update role');
    }
  };

  // Get available users (not already in team)
  const availableUsers = allUsers.filter(
    (user) => !teamMembers.some((member) => member.userId.toString() === user._id.toString())
  );

  // Get role display name
  const getRoleDisplayName = (role) => {
    const roleNames = {
      owner: 'Owner',
      pm: 'Project Manager',
      supervisor: 'Supervisor',
      site_clerk: 'Site Clerk',
      accountant: 'Accountant',
      investor: 'Investor',
      viewer: 'Viewer',
    };
    return roleNames[role] || role;
  };

  // Get role color
  const getRoleColor = (role) => {
    const colors = {
      owner: 'bg-purple-100 text-purple-800',
      pm: 'bg-blue-100 text-blue-800',
      supervisor: 'bg-green-100 text-green-800',
      site_clerk: 'bg-yellow-100 text-yellow-800',
      accountant: 'bg-indigo-100 text-indigo-800',
      investor: 'bg-pink-100 text-pink-800',
      viewer: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  if (!projectId) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800">Please select a project to manage its team.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Project Team
            </h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">
              {currentProject?.projectName} ({currentProject?.projectCode})
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/projects/${projectId}`}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              ← Back to Project
            </Link>
            {canAccess && canAccess('manage_project_team') && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                + Add Team Member
              </button>
            )}
          </div>
        </div>

        {/* Team Members List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {teamMembers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Team Members</h3>
              <p className="text-gray-600 mb-6">Add team members to collaborate on this project</p>
              {canAccess && canAccess('manage_project_team') && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
                >
                  Add First Team Member
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Project Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Global Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Joined
                    </th>
                    {canAccess && canAccess('manage_project_team') && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamMembers.map((member) => (
                    <tr key={member.membershipId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {member.user ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.user.firstName} {member.user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{member.user.email}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">User not found</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {canAccess && canAccess('manage_project_team') ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.membershipId, e.target.value)}
                            className={`px-3 py-1 text-xs font-semibold rounded-full border-0 ${getRoleColor(
                              member.role
                            )}`}
                          >
                            <option value="owner">Owner</option>
                            <option value="pm">Project Manager</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="site_clerk">Site Clerk</option>
                            <option value="accountant">Accountant</option>
                            <option value="investor">Investor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getRoleColor(
                              member.role
                            )}`}
                          >
                            {getRoleDisplayName(member.role)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {member.user?.role ? member.user.role.charAt(0).toUpperCase() + member.user.role.slice(1) : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.joinedAt
                          ? new Date(member.joinedAt).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      {canAccess && canAccess('manage_project_team') && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              setSelectedMembershipId(member.membershipId);
                              setShowRemoveModal(true);
                            }}
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Member Modal */}
        {showAddModal && (
          <ConfirmationModal
            isOpen={showAddModal}
            onClose={() => {
              setShowAddModal(false);
              setNewMember({ userId: '', role: 'site_clerk', permissions: [] });
            }}
            onConfirm={handleAddMember}
            title="Add Team Member"
            confirmText="Add Member"
            confirmButtonClass="bg-blue-600 hover:bg-blue-700"
            isLoading={addingMember}
            showCancel={true}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select User
                </label>
                <select
                  value={newMember.userId}
                  onChange={(e) => setNewMember({ ...newMember, userId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a user...</option>
                  {availableUsers.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.firstName} {user.lastName} ({user.email}) - {user.role}
                    </option>
                  ))}
                </select>
                {availableUsers.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    All users are already team members
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Role
                </label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="site_clerk">Site Clerk</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="pm">Project Manager</option>
                  <option value="accountant">Accountant</option>
                  <option value="investor">Investor</option>
                  <option value="viewer">Viewer</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>
          </ConfirmationModal>
        )}

        {/* Remove Member Modal */}
        {showRemoveModal && (
          <ConfirmationModal
            isOpen={showRemoveModal}
            onClose={() => {
              setShowRemoveModal(false);
              setSelectedMembershipId(null);
            }}
            onConfirm={handleRemoveMember}
            title="Remove Team Member"
            message="Are you sure you want to remove this team member from the project? They will lose access to this project."
            confirmText="Remove"
            confirmButtonClass="bg-red-600 hover:bg-red-700"
            isLoading={removingMemberId !== null}
            showCancel={true}
          />
        )}
      </div>
    </AppLayout>
  );
}


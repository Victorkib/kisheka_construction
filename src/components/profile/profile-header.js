/**
 * Profile Header Component
 * Displays user avatar, name, role, and verification status
 */

'use client';

export function ProfileHeader({ user }) {
  if (!user) return null;

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
  const roleDisplay = {
    owner: 'Owner',
    investor: 'Investor',
    pm: 'Project Manager',
    project_manager: 'Project Manager',
    supervisor: 'Supervisor',
    site_clerk: 'Clerk',
    clerk: 'Clerk',
    accountant: 'Accountant',
    supplier: 'Supplier',
  }[user.role?.toLowerCase()] || user.role;

  // Avatar with fallback
  const getAvatarInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName[0].toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return '👤';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center gap-6">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={fullName}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span>{getAvatarInitials()}</span>
            )}
          </div>
          {/* Online indicator */}
          <span className="absolute bottom-0 right-0 block h-6 w-6 rounded-full ring-4 ring-white bg-green-400"></span>
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            {fullName}
          </h1>
          <p className="text-lg text-gray-600 mb-2">{roleDisplay}</p>
          <div className="flex items-center gap-4 flex-wrap">
            {user.isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm font-medium rounded">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Verified
              </span>
            )}
            {user.status && (
              <span
                className={`inline-flex items-center px-2 py-1 text-sm font-medium rounded ${
                  user.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : user.status === 'inactive'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}








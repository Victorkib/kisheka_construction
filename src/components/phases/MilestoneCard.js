/**
 * Milestone Card Component
 * Displays milestone information with status, dates, completion criteria, and sign-off
 */

'use client';

import { useState } from 'react';
import { calculateMilestoneStatus } from '@/lib/constants/milestone-constants';

export function MilestoneCard({ milestone, canEdit, onEdit, onDelete, formatDate }) {
  const [showSignOffForm, setShowSignOffForm] = useState(false);
  const [signOffData, setSignOffData] = useState({
    signOffNotes: ''
  });

  const status = calculateMilestoneStatus(milestone);
  const isOverdue = status === 'overdue';
  const isCompleted = status === 'completed';

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-gray-100 text-gray-800',
      'completed': 'bg-green-100 text-green-800',
      'overdue': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleSignOff = async () => {
    if (!signOffData.signOffNotes || signOffData.signOffNotes.trim().length === 0) {
      alert('Please enter sign-off notes');
      return;
    }

    try {
      // Get current user ID
      const userResponse = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const userData = await userResponse.json();
      if (!userData.success || !userData.data?._id) {
        throw new Error('Unable to get current user');
      }

      const signOffResponse = await fetch(`/api/phases/${milestone.phaseId}/milestones/${milestone.milestoneId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          actualDate: new Date().toISOString(),
          signOffBy: userData.data._id,
          signOffDate: new Date().toISOString(),
          signOffNotes: signOffData.signOffNotes
        }),
      });

      const data = await signOffResponse.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to sign off milestone');
      }

      setShowSignOffForm(false);
      setSignOffData({ signOffNotes: '' });
      // Refresh milestone data
      if (onEdit) {
        onEdit();
      }
    } catch (err) {
      console.error('Sign off error:', err);
      alert(err.message || 'Failed to sign off milestone');
    }
  };

  return (
    <div className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
      isOverdue ? 'border-red-300 bg-red-50' : 
      isCompleted ? 'border-green-300 bg-green-50' : 
      'border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-lg font-semibold text-gray-900">
              {milestone.name}
            </h4>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
              {status.toUpperCase()}
            </span>
            {milestone.signOffRequired && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                SIGN-OFF REQUIRED
              </span>
            )}
          </div>
          {milestone.description && (
            <p className="text-sm text-gray-600 mb-3">{milestone.description}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit && onEdit(milestone)}
              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete && onDelete(milestone)}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
        <div>
          <span className="font-medium text-gray-600">Target Date:</span>{' '}
          <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-900'}>
            {milestone.targetDate ? formatDate(milestone.targetDate) : 'Not set'}
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-600">Actual Date:</span>{' '}
          <span className="text-gray-900">
            {milestone.actualDate ? formatDate(milestone.actualDate) : 'Not completed'}
          </span>
        </div>
      </div>

      {/* Completion Criteria */}
      {milestone.completionCriteria && milestone.completionCriteria.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-700 mb-2">Completion Criteria:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {milestone.completionCriteria.map((criterion, index) => (
              <li key={index}>{criterion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sign-Off Section */}
      {milestone.signOffRequired && (
        <div className="border-t pt-3 mt-3">
          {milestone.signOffBy ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-900 mb-1">✓ Signed Off</p>
              <p className="text-xs text-green-700">
                By: {milestone.signOffBy} on {milestone.signOffDate ? formatDate(milestone.signOffDate) : 'N/A'}
              </p>
              {milestone.signOffNotes && (
                <p className="text-xs text-green-600 mt-1">{milestone.signOffNotes}</p>
              )}
            </div>
          ) : (
            <div>
              {!showSignOffForm ? (
                <button
                  onClick={() => setShowSignOffForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign Off Milestone
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sign-Off Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={signOffData.signOffNotes}
                      onChange={(e) => setSignOffData({ ...signOffData, signOffNotes: e.target.value })}
                      rows={3}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter sign-off notes..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSignOff}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Confirm Sign-Off
                    </button>
                    <button
                      onClick={() => {
                        setShowSignOffForm(false);
                        setSignOffData({ signOffNotes: '' });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MilestoneCard;


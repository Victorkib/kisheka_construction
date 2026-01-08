/**
 * Floor Visualization Component
 * Visual representation of building floors including basements
 * Shows a vertical building diagram with floors stacked
 */

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { getFloorDisplayName, getFloorType, getFloorColorClass } from '@/lib/floor-helpers';

export function FloorVisualization({ floors, projectId, compact = false }) {
  // Sort floors by floor number (basements first, then ground, then above-ground)
  const sortedFloors = useMemo(() => {
    if (!floors || floors.length === 0) return [];
    return [...floors].sort((a, b) => {
      const aNum = a.floorNumber ?? 0;
      const bNum = b.floorNumber ?? 0;
      return aNum - bNum;
    });
  }, [floors]);

  if (!floors || floors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-500 text-center">No floors created yet</p>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      NOT_STARTED: 'bg-gray-200',
      IN_PROGRESS: 'bg-blue-400',
      COMPLETED: 'bg-green-400',
    };
    return colors[status] || 'bg-gray-200';
  };

  const getFloorHeight = (floor) => {
    // Basements are typically taller in visualization
    if (floor.floorNumber < 0) return 'h-16';
    if (floor.floorNumber === 0) return 'h-20'; // Ground floor is prominent
    return 'h-14'; // Standard floor height
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Building Structure</h3>
        {projectId && (
          <Link
            href={`/floors?projectId=${projectId}`}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Manage Floors →
          </Link>
        )}
      </div>

      {compact ? (
        // Compact horizontal view
        <div className="flex items-end gap-2 justify-center">
          {sortedFloors.map((floor) => {
            const floorType = getFloorType(floor.floorNumber);
            const height = floor.floorNumber < 0 ? 'h-12' : floor.floorNumber === 0 ? 'h-16' : 'h-10';
            return (
              <Link
                key={floor._id}
                href={`/floors/${floor._id}`}
                className={`${height} w-16 rounded-t-lg ${getStatusColor(floor.status)} hover:opacity-80 transition-all flex flex-col items-center justify-end p-2 cursor-pointer border-2 ${
                  floorType === 'basement' ? 'border-purple-300' :
                  floorType === 'ground' ? 'border-blue-300' :
                  'border-gray-300'
                }`}
                title={getFloorDisplayName(floor.floorNumber, floor.name)}
              >
                <span className="text-xs font-semibold text-gray-900 mb-1">
                  {floor.floorNumber < 0 ? `B${Math.abs(floor.floorNumber)}` :
                   floor.floorNumber === 0 ? 'G' :
                   floor.floorNumber}
                </span>
                <div className={`w-2 h-2 rounded-full ${
                  floor.status === 'COMPLETED' ? 'bg-green-600' :
                  floor.status === 'IN_PROGRESS' ? 'bg-blue-600' :
                  'bg-gray-400'
                }`} />
              </Link>
            );
          })}
        </div>
      ) : (
        // Full vertical building view
        <div className="flex items-center gap-6">
          {/* Building Structure */}
          <div className="flex-1">
            <div className="relative">
              {/* Ground Level Indicator */}
              <div className="absolute left-0 right-0 h-0.5 bg-gray-400 z-10">
                <div className="absolute left-0 -top-3 text-xs text-gray-600 font-semibold">Ground Level</div>
              </div>

              {/* Floors Stack */}
              <div className="flex flex-col-reverse items-center gap-1 pt-8">
                {sortedFloors.map((floor, index) => {
                  const floorType = getFloorType(floor.floorNumber);
                  const isBasement = floorType === 'basement';
                  const isGround = floorType === 'ground';
                  
                  return (
                    <Link
                      key={floor._id}
                      href={`/floors/${floor._id}`}
                      className={`w-full ${getFloorHeight(floor)} rounded-lg ${getStatusColor(floor.status)} hover:opacity-90 transition-all flex items-center justify-between px-4 cursor-pointer border-2 ${
                        isBasement ? 'border-purple-400 bg-purple-50' :
                        isGround ? 'border-blue-400 bg-blue-50' :
                        'border-gray-300 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          floor.status === 'COMPLETED' ? 'bg-green-600' :
                          floor.status === 'IN_PROGRESS' ? 'bg-blue-600' :
                          'bg-gray-400'
                        }`} />
                        <div>
                          <p className={`font-semibold ${getFloorColorClass(floor.floorNumber)}`}>
                            {getFloorDisplayName(floor.floorNumber, floor.name)}
                          </p>
                          {floor.floorNumber !== undefined && (
                            <p className="text-xs text-gray-500">Floor #{floor.floorNumber}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-700">
                          {floor.status?.replace('_', ' ') || 'NOT_STARTED'}
                        </p>
                        {floor.usageCount !== undefined && floor.usageCount > 0 && (
                          <p className="text-xs text-gray-500">
                            {floor.usageCount} material{floor.usageCount !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="w-48 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Legend</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-200 border-2 border-purple-400"></div>
                <span className="text-xs text-gray-700">Basement</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-200 border-2 border-blue-400"></div>
                <span className="text-xs text-gray-700">Ground Floor</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-200 border-2 border-gray-300"></div>
                <span className="text-xs text-gray-700">Above Ground</span>
              </div>
              <div className="pt-2 border-t border-gray-200 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-600"></div>
                  <span className="text-xs text-gray-700">Completed</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  <span className="text-xs text-gray-700">In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-xs text-gray-700">Not Started</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





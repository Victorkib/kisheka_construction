/**
 * Budget Visualization Component
 * Displays budget data in various chart formats (pie, bar, etc.)
 */

'use client';

import { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { isEnhancedBudget, getBudgetTotal, getMaterialsBudget, getLabourBudget, getContingencyBudget } from '@/lib/schemas/budget-schema';

const COLORS = {
  materials: '#3B82F6', // blue
  labour: '#10B981', // green
  equipment: '#F59E0B', // yellow
  subcontractors: '#8B5CF6', // purple
  preConstruction: '#EC4899', // pink
  indirect: '#F97316', // orange
  contingency: '#EF4444', // red
};

export function BudgetVisualization({ budget, actualSpending = null, viewType = 'pie' }) {
  const [activeView, setActiveView] = useState(viewType);

  if (!budget) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
        No budget data available
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const isEnhanced = isEnhancedBudget(budget);

  // Prepare data for charts
  let pieData = [];
  let barData = [];
  let varianceData = [];

  if (isEnhanced) {
    // Enhanced structure
    const materials = budget.directCosts?.materials?.total || 0;
    const labour = budget.directCosts?.labour?.total || 0;
    const equipment = budget.directCosts?.equipment?.total || 0;
    const subcontractors = budget.directCosts?.subcontractors?.total || 0;
    const preConstruction = budget.preConstructionCosts || 0;
    const indirect = budget.indirectCosts || 0;
    const contingency = budget.contingencyReserve || budget.contingency?.total || 0;

    pieData = [
      { name: 'Materials', value: materials, color: COLORS.materials },
      { name: 'Labour', value: labour, color: COLORS.labour },
      { name: 'Equipment', value: equipment, color: COLORS.equipment },
      { name: 'Subcontractors', value: subcontractors, color: COLORS.subcontractors },
      { name: 'Pre-Construction', value: preConstruction, color: COLORS.preConstruction },
      { name: 'Indirect Costs', value: indirect, color: COLORS.indirect },
      { name: 'Contingency', value: contingency, color: COLORS.contingency },
    ].filter(item => item.value > 0);

    barData = [
      { category: 'Materials', budget: materials, actual: actualSpending?.materials || 0 },
      { category: 'Labour', budget: labour, actual: actualSpending?.labour || 0 },
      { category: 'Equipment', budget: equipment, actual: actualSpending?.equipment || 0 },
      { category: 'Subcontractors', budget: subcontractors, actual: actualSpending?.subcontractors || 0 },
      { category: 'Pre-Construction', budget: preConstruction, actual: actualSpending?.preConstruction || 0 },
      { category: 'Indirect', budget: indirect, actual: actualSpending?.indirect || 0 },
      { category: 'Contingency', budget: contingency, actual: actualSpending?.contingency || 0 },
    ].filter(item => item.budget > 0);

    // Variance data
    if (actualSpending) {
      varianceData = barData.map(item => ({
        category: item.category,
        variance: item.actual - item.budget,
        variancePercent: item.budget > 0 ? ((item.actual - item.budget) / item.budget) * 100 : 0,
      }));
    }
  } else {
    // Legacy structure
    const materials = getMaterialsBudget(budget);
    const labour = getLabourBudget(budget);
    const contingency = getContingencyBudget(budget);
    const other = getBudgetTotal(budget) - materials - labour - contingency;

    pieData = [
      { name: 'Materials', value: materials, color: COLORS.materials },
      { name: 'Labour', value: labour, color: COLORS.labour },
      { name: 'Contingency', value: contingency, color: COLORS.contingency },
      ...(other > 0 ? [{ name: 'Other', value: other, color: COLORS.indirect }] : []),
    ].filter(item => item.value > 0);

    barData = [
      { category: 'Materials', budget: materials, actual: actualSpending?.materials || 0 },
      { category: 'Labour', budget: labour, actual: actualSpending?.labour || 0 },
      { category: 'Contingency', budget: contingency, actual: actualSpending?.contingency || 0 },
    ].filter(item => item.budget > 0);

    if (actualSpending) {
      varianceData = barData.map(item => ({
        category: item.category,
        variance: item.actual - item.budget,
        variancePercent: item.budget > 0 ? ((item.actual - item.budget) / item.budget) * 100 : 0,
      }));
    }
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-900">{payload[0].name}</p>
          <p className="text-sm text-gray-600">
            {formatCurrency(payload[0].value)}
            {payload[0].payload.percentage && (
              <span className="ml-2">({payload[0].payload.percentage.toFixed(1)}%)</span>
            )}
          </p>
          {payload[0].payload.actual !== undefined && (
            <p className="text-sm text-gray-500 mt-1">
              Actual: {formatCurrency(payload[0].payload.actual)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't show labels for very small slices

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-semibold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Budget Visualization</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('pie')}
            className={`px-3 py-1 text-sm rounded ${
              activeView === 'pie'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pie Chart
          </button>
          <button
            onClick={() => setActiveView('bar')}
            className={`px-3 py-1 text-sm rounded ${
              activeView === 'bar'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Bar Chart
          </button>
          {actualSpending && (
            <button
              onClick={() => setActiveView('variance')}
              className={`px-3 py-1 text-sm rounded ${
                activeView === 'variance'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Variance
            </button>
          )}
        </div>
      </div>

      {activeView === 'pie' && (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value, entry) => (
                  <span style={{ color: entry.color }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeView === 'bar' && (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="category"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="budget" fill="#3B82F6" name="Budget" />
              {actualSpending && <Bar dataKey="actual" fill="#10B981" name="Actual" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeView === 'variance' && varianceData.length > 0 && (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={varianceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="category"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                label={{ value: 'Variance (%)', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => `${value.toFixed(0)}%`}
              />
              <Tooltip
                formatter={(value) => [`${value.toFixed(2)}%`, 'Variance']}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
              />
              <Bar
                dataKey="variancePercent"
                fill={(entry) => {
                  if (entry > 10) return '#EF4444'; // red for over budget
                  if (entry > 5) return '#F59E0B'; // yellow for at risk
                  if (entry < -5) return '#10B981'; // green for under budget
                  return '#6B7280'; // gray for on track
                }}
                name="Variance %"
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {varianceData.map((item) => {
              const isOver = item.variancePercent > 5;
              const isUnder = item.variancePercent < -5;
              return (
                <div
                  key={item.category}
                  className={`p-3 rounded-lg ${
                    isOver
                      ? 'bg-red-50 border border-red-200'
                      : isUnder
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <p className="text-xs text-gray-600 mb-1">{item.category}</p>
                  <p
                    className={`text-lg font-semibold ${
                      isOver ? 'text-red-600' : isUnder ? 'text-green-600' : 'text-gray-700'
                    }`}
                  >
                    {item.variancePercent > 0 ? '+' : ''}
                    {item.variancePercent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatCurrency(item.variance)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pieData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No budget data to visualize
        </div>
      )}
    </div>
  );
}




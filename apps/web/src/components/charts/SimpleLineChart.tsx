'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SimpleLineChartProps {
  data: Array<{ [key: string]: any }>;
  dataKey?: string;
  xAxisKey?: string;
  title?: string;
  height?: number;
  showGrid?: boolean;
  lineColor?: string;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  title,
  height = 300,
  showGrid = true,
  lineColor = '#3b82f6', // Professional blue
}) => {
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e5e7eb" 
              className="dark:stroke-gray-700"
            />
          )}
          <XAxis 
            dataKey={xAxisKey}
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#6b7280' }}
          />
          <YAxis 
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#6b7280' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#374151', fontWeight: 600 }}
          />
          <Line 
            type="monotone" 
            dataKey={dataKey}
            stroke={lineColor}
            strokeWidth={2}
            dot={{ fill: lineColor, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleLineChart;


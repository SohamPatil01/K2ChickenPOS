'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SimpleBarChartProps {
  data: Array<{ name: string; value: number; [key: string]: any }>;
  dataKey?: string;
  xAxisKey?: string;
  title?: string;
  height?: number;
  showGrid?: boolean;
  barColor?: string;
  horizontal?: boolean;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  title,
  height = 300,
  showGrid = true,
  barColor = '#10b981', // Professional green
  horizontal = false,
}) => {
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart 
          data={data} 
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 5, right: 20, bottom: 5, left: horizontal ? 20 : 0 }}
        >
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e5e7eb"
              className="dark:stroke-gray-700"
            />
          )}
          {horizontal ? (
            <>
              <XAxis 
                type="number"
                stroke="#9ca3af"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#6b7280' }}
              />
              <YAxis 
                dataKey={xAxisKey}
                type="category"
                stroke="#9ca3af"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#6b7280' }}
                width={100}
              />
            </>
          ) : (
            <>
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
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#374151', fontWeight: 600 }}
          />
          <Bar 
            dataKey={dataKey}
            fill={barColor}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleBarChart;


'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Zap, Target } from 'lucide-react';

interface PipelineAnalytics {
  total_leads: number;
  by_status: { [key: string]: number };
  by_temperature: { [key: string]: number };
  average_lead_score: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
}

export default function LeadDashboard() {
  const [analytics, setAnalytics] = useState<PipelineAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/broker/leads/analytics?type=pipeline');
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const statusData = Object.entries(analytics.by_status).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count
  }));

  const temperatureData = [
    { name: 'Hot', value: analytics.hot_leads, color: '#ef4444' },
    { name: 'Warm', value: analytics.warm_leads, color: '#f97316' },
    { name: 'Cold', value: analytics.cold_leads, color: '#60a5fa' }
  ];

  const metrics = [
    {
      icon: Users,
      label: 'Total Leads',
      value: analytics.total_leads,
      color: 'bg-blue-50'
    },
    {
      icon: Zap,
      label: 'Hot Leads',
      value: analytics.hot_leads,
      color: 'bg-red-50'
    },
    {
      icon: TrendingUp,
      label: 'Avg Score',
      value: analytics.average_lead_score.toFixed(1),
      color: 'bg-green-50'
    },
    {
      icon: Target,
      label: 'Qualified',
      value: analytics.by_status.qualified || 0,
      color: 'bg-purple-50'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className={`${metric.color} rounded-lg p-6 border border-gray-200`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{metric.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {metric.value}
                  </p>
                </div>
                <Icon className="w-8 h-8 text-gray-400" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Status */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Pipeline by Status
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Temperature Distribution */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Lead Temperature
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={temperatureData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {temperatureData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

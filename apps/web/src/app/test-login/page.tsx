'use client';

import { useState } from 'react';
import api from '@/lib/api';

export default function TestLoginPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await api.post('/api/v1/auth/login', {
        phone: '9999999999',
        password: 'owner123',
      });
      setResult({ success: true, data: response.data });
    } catch (error: any) {
      setResult({
        success: false,
        error: {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          stack: error.stack,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Login Test Page</h1>
      <button
        onClick={testLogin}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Login API'}
      </button>
      
      {result && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h2 className="font-bold mb-2">
            {result.success ? '✓ Success' : '✗ Error'}
          </h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      <div className="mt-4">
        <h2 className="font-bold mb-2">API URL:</h2>
        <code className="text-sm">{process.env.NEXT_PUBLIC_API_URL || 'Not set'}</code>
      </div>
    </div>
  );
}


import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  CheckCircle2,
  ShieldAlert,
  Server,
  GitBranch,
  Layers,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ConnectionStatus = 'testing' | 'success' | 'failed';

export const StatusPage: React.FC = () => {
  const supabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('testing');

  const [connectionMessage, setConnectionMessage] = useState(
    'Testing connection to Supabase...'
  );

  const [branchCount, setBranchCount] = useState<number | null>(null);

  const coreTables = [
    {
      name: 'branches',
      description:
        'Moodubidre, Alvas Vidayagiri, and Alvas Mijar',
    },
    {
      name: 'profiles',
      description:
        'Authenticated user profiles with mandatory roles & branch scoping',
    },
    {
      name: 'products',
      description:
        'Product catalogue definitions with 15 predefined categories',
    },
    {
      name: 'product_variants',
      description:
        'Sellable product variants (0.5 KG, 1 KG, 1 Piece, etc.)',
    },
    {
      name: 'pricing_rules',
      description:
        'Separated Standard Menu Price vs Custom Price models',
    },
    {
      name: 'product_batches',
      description:
        'Batch-specific production & mandatory expiry date tracking',
    },
    {
      name: 'inventory',
      description:
        'Branch-specific, variant-specific, batch-aware stock counts',
    },
    {
      name: 'inventory_movements',
      description:
        'Immutable audit log for all stock movements & operations',
    },
  ];

  const testSupabaseConnection = async () => {
    setConnectionStatus('testing');
    setConnectionMessage('Testing Supabase connection...');
    setBranchCount(null);

    try {
      if (!supabaseConfigured) {
        throw new Error(
          'Supabase environment variables are missing.'
        );
      }

      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Testing branches table...');

      const { data, error, count } = await supabase
        .from('branches')
        .select('id', { count: 'exact' })
        .limit(1);

      if (error) {
        console.error('Supabase query error:', error);

        setConnectionStatus('failed');
        setConnectionMessage(
          `${error.message} | Code: ${error.code || 'N/A'}`
        );

        return;
      }

      setBranchCount(count ?? data?.length ?? 0);
      setConnectionStatus('success');

      setConnectionMessage(
        `Connected successfully. Branch records detected: ${
          count ?? data?.length ?? 0
        }`
      );

      console.log('Supabase connection successful:', data);
    } catch (error) {
      console.error('Supabase connection failed:', error);

      setConnectionStatus('failed');

      if (error instanceof TypeError) {
        setConnectionMessage(
          'Browser could not reach Supabase. Check the Supabase URL, network connection, browser extensions, or project status.'
        );
      } else if (error instanceof Error) {
        setConnectionMessage(error.message);
      } else {
        setConnectionMessage('Unknown connection error.');
      }
    }
  };

  useEffect(() => {
    testSupabaseConnection();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">
          System Foundation Status
        </h2>

        <p className="text-sm text-slate-600 mt-1">
          Project foundation and database architecture initialized for
          Brownie Point Operations System.
        </p>
      </div>

      {/* Environment */}
      <Card
        title="Environment & Supabase Configuration"
        subtitle="Verify frontend environment variable status"
      >
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-3">
            <Server className="w-5 h-5 text-slate-600" />

            <div>
              <p className="text-sm font-medium text-slate-800">
                Supabase Connection Credentials
              </p>

              <p className="text-xs text-slate-500">
                {supabaseConfigured
                  ? 'Environment variables loaded from .env.local'
                  : 'Supabase environment variables are missing.'}
              </p>
            </div>
          </div>

          <Badge
            variant={supabaseConfigured ? 'success' : 'warning'}
          >
            {supabaseConfigured
              ? 'Configured'
              : 'Missing Credentials'}
          </Badge>
        </div>
      </Card>

      {/* LIVE CONNECTION TEST */}
      <Card
        title="Live Database Connection"
        subtitle="Actual Supabase query against the branches table"
      >
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              {connectionStatus === 'testing' && (
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              )}

              {connectionStatus === 'success' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}

              {connectionStatus === 'failed' && (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}

              <div>
                <p className="text-sm font-medium text-slate-800">
                  Supabase Database
                </p>

                <p className="text-xs text-slate-500">
                  {connectionMessage}
                </p>

                {branchCount !== null && (
                  <p className="text-xs text-emerald-700 mt-1 font-medium">
                    Branch records found: {branchCount}
                  </p>
                )}
              </div>
            </div>

            <Badge
              variant={
                connectionStatus === 'success'
                  ? 'success'
                  : connectionStatus === 'testing'
                  ? 'warning'
                  : 'warning'
              }
            >
              {connectionStatus === 'success'
                ? 'Connected'
                : connectionStatus === 'testing'
                ? 'Testing...'
                : 'Failed'}
            </Badge>
          </div>

          <button
            onClick={testSupabaseConnection}
            disabled={connectionStatus === 'testing'}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-900 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Test Connection Again
          </button>
        </div>
      </Card>

      {/* Core Tables */}
      <Card
        title="Database Architecture (8 Core Tables Prepared)"
        subtitle="PostgreSQL Migration: supabase/migrations/20260930000000_initial_schema.sql"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {coreTables.map((table) => (
            <div
              key={table.name}
              className="p-3 bg-white border border-slate-200 rounded-lg flex items-start space-x-3"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />

              <div>
                <span className="text-sm font-semibold font-mono text-brand-900">
                  {table.name}
                </span>

                <p className="text-xs text-slate-500 mt-0.5">
                  {table.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Architecture Rules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Security & RLS">
          <div className="flex flex-col space-y-2 text-xs text-slate-600">
            <div className="flex items-center space-x-2 text-slate-800 font-medium">
              <ShieldAlert className="w-4 h-4 text-brand-700" />

              <span>Row Level Security</span>
            </div>

            <p>
              Database-level RLS policies enforce branch scoping.
              Employees cannot access data outside their assigned
              branch.
            </p>
          </div>
        </Card>

        <Card title="FEFO Inventory">
          <div className="flex flex-col space-y-2 text-xs text-slate-600">
            <div className="flex items-center space-x-2 text-slate-800 font-medium">
              <Layers className="w-4 h-4 text-brand-700" />

              <span>First Expiry, First Out</span>
            </div>

            <p>
              Stock is tracked per batch with expiry dates. FEFO view
              (
              <code className="font-mono">
                v_fefo_inventory
              </code>
              ) handles earliest expiry prioritization.
            </p>
          </div>
        </Card>

        <Card title="Branch Setup">
          <div className="flex flex-col space-y-2 text-xs text-slate-600">
            <div className="flex items-center space-x-2 text-slate-800 font-medium">
              <GitBranch className="w-4 h-4 text-brand-700" />

              <span>3 Branches</span>
            </div>

            <p>
              Configured branches: Moodubidre (MAIN), Alvas Vidayagiri, and
              Alvas Mijar (SUB_BRANCH).
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
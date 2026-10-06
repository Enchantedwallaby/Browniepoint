import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import type { RouteId } from '@/types/navigation';

interface AccessDeniedPageProps {
  attemptedRoute: string;
  onNavigate: (route: RouteId) => void;
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({
  attemptedRoute,
  onNavigate,
}) => {
  return (
    <div className="max-w-xl mx-auto py-12">
      <Card className="text-center p-8 border-rose-200">
        <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-sm text-slate-600 mb-6">
          You do not have permission to access the <code className="font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded">/{attemptedRoute}</code> page based on your assigned role and security policies.
        </p>
        <Button variant="primary" onClick={() => onNavigate('dashboard')}>
          <ArrowLeft className="w-4 h-4" />
          Return to Dashboard
        </Button>
      </Card>
    </div>
  );
};

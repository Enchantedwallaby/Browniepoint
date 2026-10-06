import { useEffect, useState } from 'react';
import type { Profile, Branch } from '@/types/database';
import { authService } from '@/services/authService';
import { branchService } from '@/services/branchService';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignedBranch, setAssignedBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;

        if (session?.user) {
          const p = await authService.getCurrentProfile();
          if (!cancelled) setProfile(p);

          if (p?.branch_id) {
            try {
              const b = await branchService.getBranchById(p.branch_id);
              if (!cancelled) setAssignedBranch(b);
            } catch (err) {
              console.error('Error fetching assigned branch:', err);
              if (!cancelled) setAssignedBranch(null);
            }
          } else {
            if (!cancelled) setAssignedBranch(null);
          }
        } else {
          if (!cancelled) {
            setProfile(null);
            setAssignedBranch(null);
          }
        }

        if (!cancelled) setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return {
    profile,
    assignedBranch,
    loading,
    isOwner: profile?.role === 'OWNER',
    isMainBranchEmployee: profile?.role === 'MAIN_BRANCH_EMPLOYEE',
    isBranchEmployee: profile?.role === 'BRANCH_EMPLOYEE',
  };
}

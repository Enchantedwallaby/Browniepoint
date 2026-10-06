import { useEffect, useState } from 'react';
import type { Profile, Branch } from '@/types/database';
import { ACCESS_DISABLED_MESSAGE, authService } from '@/services/authService';
import { branchService } from '@/services/branchService';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignedBranch, setAssignedBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handleSession = async (sessionUserId: string | undefined) => {
      if (!sessionUserId) {
        if (!cancelled) {
          setProfile(null);
          setAssignedBranch(null);
          setLoading(false);
        }
        return;
      }

      const currentProfile = await authService.getCurrentProfile();
      if (cancelled) return;

      if (!currentProfile || !currentProfile.active) {
        setProfile(null);
        setAssignedBranch(null);
        setAuthMessage(currentProfile ? ACCESS_DISABLED_MESSAGE : 'Unable to verify account access. Please contact the Owner.');
        setLoading(false);
        window.setTimeout(() => {
          void supabase.auth.signOut();
        }, 0);
        return;
      }

      setAuthMessage(null);
      setProfile(currentProfile);
      if (currentProfile.branch_id) {
        try {
          const branch = await branchService.getBranchById(currentProfile.branch_id);
          if (!cancelled) setAssignedBranch(branch);
        } catch (err) {
          console.error('Error fetching assigned branch:', err);
          if (!cancelled) setAssignedBranch(null);
        }
      } else {
        setAssignedBranch(null);
      }
      if (!cancelled) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void handleSession(session?.user.id);
      }, 0);
    });

    const verifyCurrentAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const currentProfile = await authService.getCurrentProfile();
      if (!currentProfile || !currentProfile.active) {
        setAuthMessage(currentProfile ? ACCESS_DISABLED_MESSAGE : 'Unable to verify account access. Please contact the Owner.');
        setProfile(null);
        setAssignedBranch(null);
        await supabase.auth.signOut();
      }
    };

    const intervalId = window.setInterval(() => {
      void verifyCurrentAccess();
    }, 15000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void verifyCurrentAccess();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      subscription.unsubscribe();
    };
  }, []);

  return {
    profile,
    assignedBranch,
    loading,
    authMessage,
    isOwner: profile?.role === 'OWNER',
    isMainBranchEmployee: profile?.role === 'MAIN_BRANCH_EMPLOYEE',
    isBranchEmployee: profile?.role === 'BRANCH_EMPLOYEE',
  };
}

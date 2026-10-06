import { useEffect, useRef, useState } from 'react';
import type { Profile, Branch } from '@/types/database';
import { ACCESS_DISABLED_MESSAGE, authService } from '@/services/authService';
import { branchService } from '@/services/branchService';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignedBranch, setAssignedBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const activeUserId = useRef<string | null>(null);
  const sessionRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const handleSession = async (
      sessionUserId: string | undefined,
      requestId: number
    ) => {
      if (!sessionUserId) {
        if (!cancelled && requestId === sessionRequest.current) {
          setProfile(null);
          setAssignedBranch(null);
          setAuthMessage(null);
          setLoading(false);
        }
        return;
      }

      const currentProfile = await authService.getCurrentProfile();
      if (
        cancelled ||
        requestId !== sessionRequest.current ||
        activeUserId.current !== sessionUserId
      ) return;

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

      let branch: Branch | null = null;
      if (currentProfile.branch_id) {
        try {
          branch = await branchService.getBranchById(currentProfile.branch_id);
        } catch (err) {
          console.error('Error fetching assigned branch:', err);
        }
      }

      if (
        cancelled ||
        requestId !== sessionRequest.current ||
        activeUserId.current !== sessionUserId
      ) return;

      setAuthMessage(null);
      setProfile(currentProfile);
      setAssignedBranch(branch);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUserId = session?.user.id ?? null;
      const userChanged = activeUserId.current !== sessionUserId;
      activeUserId.current = sessionUserId;
      const requestId = ++sessionRequest.current;

      if (userChanged) {
        setProfile(null);
        setAssignedBranch(null);
        setLoading(sessionUserId !== null);
      }

      window.setTimeout(() => {
        void handleSession(sessionUserId ?? undefined, requestId);
      }, 0);
    });

    const verifyCurrentAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const sessionUserId = session.user.id;
      const currentProfile = await authService.getCurrentProfile();
      const { data: { session: latestSession } } = await supabase.auth.getSession();
      if (
        cancelled ||
        activeUserId.current !== sessionUserId ||
        latestSession?.user.id !== sessionUserId
      ) return;

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

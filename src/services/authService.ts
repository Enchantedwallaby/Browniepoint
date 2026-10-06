import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export const ACCESS_DISABLED_MESSAGE =
  'Your login access has been disabled. Please contact the Owner.';

export const authService = {
  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('banned')) {
        throw new Error(ACCESS_DISABLED_MESSAGE);
      }
      throw error;
    }

    const profile = await this.getCurrentProfile();
    if (!profile || !profile.active) {
      await supabase.auth.signOut().catch(() => undefined);
      throw new Error(profile ? ACCESS_DISABLED_MESSAGE : 'Unable to verify account access. Please contact the Owner.');
    }
  },

  async getCurrentProfile(): Promise<Profile | null> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return null;
    }

    return profile;
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },
};

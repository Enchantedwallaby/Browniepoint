import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/database';

export type CreatableEmployeeRole = Exclude<UserRole, 'OWNER'>;

export interface CreateEmployeeParams {
  email: string;
  password: string;
  full_name: string;
  role: CreatableEmployeeRole;
  branch_id: string | null;
}

export type EmployeeAccessAction = 'REMOVE' | 'RESTORE';

export const employeeService = {
  async listEmployees(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error listing employees:', error);
      throw error;
    }

    return data ?? [];
  },

  async createEmployee(params: CreateEmployeeParams): Promise<Profile> {
    const { data, error } = await supabase.functions.invoke('create-employee', {
      body: params,
    });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        try {
          const payload = await error.context.json();
          if (payload?.error) {
            throw new Error(String(payload.error));
          }
        } catch (parsed) {
          if (parsed instanceof Error && parsed.message !== error.message) {
            throw parsed;
          }
        }
      }
      throw new Error(error.message || 'Failed to create employee.');
    }

    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error));
    }

    const profile = data?.profile as Profile | undefined;
    if (!profile) {
      throw new Error('Employee was created but the profile was not returned.');
    }

    return profile;
  },

  async setEmployeeAccess(employeeId: string, action: EmployeeAccessAction): Promise<Profile> {
    const { data, error } = await supabase.functions.invoke('manage-employee-access', {
      body: { employee_id: employeeId, action },
    });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        try {
          const payload = await error.context.json();
          if (payload?.error) throw new Error(String(payload.error));
        } catch (parsed) {
          if (parsed instanceof Error && parsed.message !== error.message) throw parsed;
        }
      }
      throw new Error(error.message || 'Failed to update employee access.');
    }

    const profile = data?.profile as Profile | undefined;
    if (!profile) throw new Error('Employee access was updated but the profile was not returned.');
    return profile;
  },
};

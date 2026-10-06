import type { UserRole } from '@/types/database';

export type RouteId =
  | 'dashboard'
  | 'branches'
  | 'catalogue'
  | 'inventory'
  | 'transfers'
  | 'orders'
  | 'sales'
  | 'returns'
  | 'reports'
  | 'status'
  | 'audit';

export interface NavItem {
  id: RouteId;
  label: string;
  iconName: string;
  roles: UserRole[];
}

export const PERMITTED_ROUTES_BY_ROLE: Record<UserRole, RouteId[]> = {
  OWNER: [
    'dashboard',
    'branches',
    'catalogue',
    'inventory',
    'transfers',
    'orders',
    'sales',
    'returns',
    'reports',
    'status',
    'audit',
  ],
  MAIN_BRANCH_EMPLOYEE: [
    'dashboard',
    'inventory',
    'transfers',
    'orders',
    'sales',
    'returns',
    'reports',
    'status',
  ],
  BRANCH_EMPLOYEE: [
    'dashboard',
    'inventory',
    'transfers',
    'orders',
    'sales',
    'returns',
    'status',
  ],
};

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  GitBranch,
  Store,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';
import { branchService } from '@/services/branchService';
import { employeeService } from '@/services/employeeService';
import type { Branch, Profile, UserRole } from '@/types/database';

interface BranchesPageProps {
  profile: Profile;
}

const ROLE_LABEL: Record<UserRole, string> = {
  OWNER: 'Owner',
  MAIN_BRANCH_EMPLOYEE: 'Main Branch Employee',
  BRANCH_EMPLOYEE: 'Branch Employee',
};

export const BranchesPage: React.FC<BranchesPageProps> = ({ profile }) => {
  const isOwner = profile.role === 'OWNER';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('Alvas Vidayagiri Employee');
  const [email, setEmail] = useState('branch1@browniepoint.com');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'OWNER'>>('BRANCH_EMPLOYEE');
  const [branchId, setBranchId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<Profile | null>(null);
  const [updatingAccessFor, setUpdatingAccessFor] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const branchData = await branchService.getActiveBranches();
      setBranches(branchData);

      if (!branchId) {
        const branch1 = branchData.find((b) => b.branch_code === 'BRANCH_1');
        if (branch1) setBranchId(branch1.id);
      }

      if (isOwner) {
        const employeeData = await employeeService.listEmployees();
        setEmployees(employeeData);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load branch data.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const matching = branches.filter((b) =>
      role === 'MAIN_BRANCH_EMPLOYEE' ? b.branch_type === 'MAIN' : b.branch_type === 'SUB_BRANCH'
    );
    if (!matching.some((b) => b.id === branchId)) {
      const preferred =
        role === 'BRANCH_EMPLOYEE'
          ? matching.find((b) => b.branch_code === 'BRANCH_1') || matching[0]
          : matching[0];
      setBranchId(preferred?.id ?? '');
    }
  }, [role, branches, branchId]);

  const branchNameById = (id: string | null) => {
    if (!id) return 'Unassigned';
    return branches.find((b) => b.id === id)?.name ?? 'Unknown branch';
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateMessage(null);
    setCreating(true);

    try {
      const created = await employeeService.createEmployee({
        email,
        password,
        full_name: fullName,
        role,
        branch_id: role === 'BRANCH_EMPLOYEE' ? branchId : branchId || null,
      });
      setCreateMessage(`Created ${created.email} as ${ROLE_LABEL[created.role]}.`);
      setPassword('');
      const employeeData = await employeeService.listEmployees();
      setEmployees(employeeData);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create employee.');
    } finally {
      setCreating(false);
    }
  };

  const handleEmployeeAccess = async (employee: Profile, action: 'REMOVE' | 'RESTORE') => {
    setAccessError(null);
    setUpdatingAccessFor(employee.id);

    try {
      await employeeService.setEmployeeAccess(employee.id, action);
      setEmployees(await employeeService.listEmployees());
      setEmployeeToDeactivate(null);
    } catch (err: unknown) {
      setAccessError(err instanceof Error ? err.message : 'Failed to update employee access.');
    } finally {
      setUpdatingAccessFor(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-brand-700" />
            Branch Management
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Overview and operational status of Moodubidre and its sub-branches.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading branch network...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map((b) => (
            <Card key={b.id} className="hover:border-brand-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-xl ${b.branch_type === 'MAIN' ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-700'}`}>
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{b.name}</h3>
                    <p className="text-xs font-mono text-slate-500">{b.branch_code}</p>
                  </div>
                </div>
                <Badge variant={b.branch_type === 'MAIN' ? 'primary' : 'secondary'}>
                  {b.branch_type === 'MAIN' ? 'Main Branch' : 'Sub-Branch'}
                </Badge>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active Operational Branch
                </span>
                <span>System Branch</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-700" />
            <h3 className="text-lg font-bold text-slate-900">Employees</h3>
          </div>
          <p className="text-sm text-slate-600">
            Create logins with Supabase Auth. Passwords are stored only in Auth, not in public tables.
          </p>

          <Card>
            <form onSubmit={handleCreateEmployee} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <UserPlus className="w-4 h-4 text-brand-700" />
                Create employee
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full name</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Temporary password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Exclude<UserRole, 'OWNER'>)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="BRANCH_EMPLOYEE">Branch Employee</option>
                  <option value="MAIN_BRANCH_EMPLOYEE">Main Branch Employee</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Assigned branch</label>
                <select
                  required={role === 'BRANCH_EMPLOYEE'}
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Select branch</option>
                  {branches
                    .filter((b) => (role === 'MAIN_BRANCH_EMPLOYEE' ? b.branch_type === 'MAIN' : b.branch_type === 'SUB_BRANCH'))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.branch_code})
                      </option>
                    ))}
                </select>
              </div>

              {createError && (
                <div className="sm:col-span-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
                  {createError}
                </div>
              )}
              {createMessage && (
                <div className="sm:col-span-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                  {createMessage}
                </div>
              )}

              <div className="sm:col-span-2">
                <Button type="submit" disabled={creating || !password}>
                  {creating ? 'Creating…' : 'Create employee'}
                </Button>
              </div>
            </form>
          </Card>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Name</th>
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Role</th>
                  <th className="px-4 py-2 font-semibold">Branch</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-900">{emp.full_name}</td>
                    <td className="px-4 py-2 text-slate-600">{emp.email}</td>
                    <td className="px-4 py-2">
                      <Badge variant={emp.role === 'OWNER' ? 'success' : 'secondary'}>
                        {ROLE_LABEL[emp.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{branchNameById(emp.branch_id)}</td>
                    <td className="px-4 py-2">
                      <Badge variant={emp.active ? 'success' : 'danger'}>
                        {emp.active ? 'Active' : 'Access Removed'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      {emp.role !== 'OWNER' && emp.id !== profile.id ? (
                        emp.active ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAccessError(null);
                              setEmployeeToDeactivate(emp);
                            }}
                            className="text-xs font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-50"
                            disabled={updatingAccessFor === emp.id}
                          >
                            Remove Access
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEmployeeAccess(emp, 'RESTORE')}
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
                            disabled={updatingAccessFor === emp.id}
                          >
                            {updatingAccessFor === emp.id ? 'Restoring…' : 'Restore Access'}
                          </button>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {accessError && !employeeToDeactivate && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
              {accessError}
            </div>
          )}

          {employeeToDeactivate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="remove-access-title"
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              >
                <h3 id="remove-access-title" className="text-lg font-bold text-slate-900">
                  Remove Login Access?
                </h3>
                <p className="mt-3 text-sm text-slate-700">
                  {employeeToDeactivate.full_name} will no longer be able to log in to the Brownie Point Operations System.
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Existing sales, orders, transfers, returns and audit history will <strong>NOT</strong> be deleted.
                </p>
                {accessError && (
                  <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
                    {accessError}
                  </div>
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeToDeactivate(null);
                      setAccessError(null);
                    }}
                    disabled={updatingAccessFor === employeeToDeactivate.id}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEmployeeAccess(employeeToDeactivate, 'REMOVE')}
                    disabled={updatingAccessFor === employeeToDeactivate.id}
                    className="px-4 py-2 rounded-lg bg-rose-700 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                  >
                    {updatingAccessFor === employeeToDeactivate.id ? 'Removing…' : 'Remove Access'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

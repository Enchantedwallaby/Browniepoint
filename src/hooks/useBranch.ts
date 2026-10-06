import { useEffect, useState } from 'react';
import type { Branch } from '@/types/database';
import { branchService } from '@/services/branchService';

export function useBranch() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    branchService.getActiveBranches()
      .then(setBranches)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { branches, loading, error };
}

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { askStatus } from './ask-api';

export function useAskEnabled() {
  const { user, role, loading } = useAuth();
  const eligible = !loading && !!user && (role === 'agent' || String(role) === 'new_agent');
  const identity = eligible ? `${user?.id}:${role}` : null;
  const [enabledFor, setEnabledFor] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setEnabledFor(null);
    if (identity) {
      askStatus().then(enabled => {
        if (active && enabled) setEnabledFor(identity);
      }).catch(() => { /* Fail closed; existing chat remains available. */ });
    }
    return () => { active = false; };
  }, [identity]);
  return identity !== null && enabledFor === identity;
}

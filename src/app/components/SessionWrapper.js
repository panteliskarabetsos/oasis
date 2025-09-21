// src/app/components/SessionWrapper.js
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

const AuthContext = createContext({ user: null, loading: true, supabase: null });

export function useAuth() {
  return useContext(AuthContext);
}

export default function SessionWrapper({ children }) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // initial fetch
    supabase.auth.getUser()
      .then(({ data }) => { if (mounted) setUser(data.user ?? null); })
      .finally(() => { if (mounted) setLoading(false); });

    // subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, loading, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}

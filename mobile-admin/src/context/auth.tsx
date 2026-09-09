import type { Session } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api, registerSessionGetter } from "@/lib/api";
import { can, toAccess, type Access } from "@/lib/permissions";
import { getSupabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Effective component access for the signed-in staff member. */
  access: Access;
  /** Does this staff member hold `permission`? Omit it to ask "are they staff?". */
  can: (permission?: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  access: [],
  can: () => false,
  signIn: async () => ({ error: "Auth not configured" }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    registerSessionGetter(() => sessionRef.current);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!sessionRef.current) {
      setProfile(null);
      return;
    }
    try {
      const me = await api.me();
      setProfile(me);
    } catch {
      // keep last known profile on transient errors
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) refreshProfile();
    else setProfile(null);
  }, [session, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return {
        error:
          "Auth is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to mobile/.env.",
      };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase?.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const access = useMemo(() => toAccess(profile?.permissions), [profile?.permissions]);
  const canDo = useCallback((permission?: string) => can(access, permission), [access]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        access,
        can: canDo,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

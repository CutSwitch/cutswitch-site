"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type AuthState = {
  supabase: SupabaseClient | null;
  session: Session | null;
  user: User | null;
  loading: boolean;
  configError: string | null;
};

export function useSupabaseSession(): AuthState {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  return {
    supabase,
    session,
    user: session?.user ?? null,
    loading,
    configError: supabase ? null : "Supabase browser auth is not configured.",
  };
}

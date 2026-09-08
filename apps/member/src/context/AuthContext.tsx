import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@jollify/shared/lib/supabase";

interface MemberInfo {
  id: string;
  tenantId: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  member: MemberInfo | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  reloadMember: () => Promise<MemberInfo | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMember = async (userId: string): Promise<MemberInfo | null> => {
    const { data } = await supabase
      .from("members")
      .select("id, tenant_id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const resolved = data ? { id: data.id, tenantId: data.tenant_id } : null;
    setMember(resolved);
    return resolved;
  };

  const reloadMember = async (): Promise<MemberInfo | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return loadMember(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadMember(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setLoading(true);
        loadMember(session.user.id).finally(() => setLoading(false));
      } else {
        setMember(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMember(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, member, loading, signIn, signOut, reloadMember }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

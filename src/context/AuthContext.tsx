import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface TenantInfo {
  id: string;
  name: string;
  status: string;
  billing_plan: string;
  slug: string;
  cooperative_number: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  tenant: TenantInfo | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  reloadTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTenant = async (_userId: string) => {
    // Primary: call the security-definer RPC which bypasses RLS on tenant_users
    const { data: tenantId } = await supabase.rpc("get_tenant_id");

    if (tenantId) {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, status, billing_plan, slug, cooperative_number")
        .eq("id", tenantId)
        .maybeSingle();
      setTenant(data as TenantInfo | null);
      return;
    }

    // Fallback: direct join (works once tenant_users_self_read policy exists)
    const { data } = await supabase
      .from("tenant_users")
      .select("tenant_id, tenants(id, name, status, billing_plan, slug, cooperative_number)")
      .maybeSingle();

    setTenant(data?.tenants ? (data.tenants as unknown as TenantInfo) : null);
  };

  const reloadTenant = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await loadTenant(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadTenant(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadTenant(session.user.id);
      } else {
        setTenant(null);
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
    setTenant(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, tenant, loading, signIn, signOut, reloadTenant }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

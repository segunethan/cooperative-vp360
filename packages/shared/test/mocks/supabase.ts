import { vi } from "vitest";

/**
 * Creates a chainable Supabase query builder mock.
 * Supports arbitrary chains (.select().eq().order().limit()) all resolving to `resolveWith`.
 */
export const createQueryMock = (resolveWith: { data: unknown; error: unknown }) => {
  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      if (prop === "then") {
        // Make it thenable — the chain itself resolves when awaited
        return (resolve: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(resolve);
      }
      // Every method returns a new proxy (allowing further chaining)
      return vi.fn().mockReturnValue(new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
};

/**
 * Creates a Supabase mock where `from(tableName)` returns a configurable chain.
 * Usage:
 *   const mock = createSupabaseMock({ "members": { data: [...], error: null } });
 *   vi.mocked(supabase).from.mockImplementation(mock.from);
 */
export const createSupabaseMock = (
  tableResponses: Record<string, { data: unknown; error: unknown }>
) => ({
  from: vi.fn((table: string) =>
    createQueryMock(tableResponses[table] ?? { data: [], error: null })
  ),
  rpc: vi.fn(),
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
});

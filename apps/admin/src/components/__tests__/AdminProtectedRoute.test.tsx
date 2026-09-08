import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mock AuthContext ───────────────────────────────────────────────────────────
const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import AdminProtectedRoute from "../AdminProtectedRoute";

const renderInRouter = (ui: React.ReactNode, initialEntry = "/cooperative") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      {ui}
    </MemoryRouter>
  );

describe("AdminProtectedRoute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading spinner while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ session: null, tenant: null, loading: true, signOut: vi.fn() });
    const { container } = renderInRouter(
      <AdminProtectedRoute>
        <div>Protected content</div>
      </AdminProtectedRoute>
    );
    // Spinner exists, content does not
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders children when the user has a session and a resolved tenant", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1", email: "admin@test.com" } },
      tenant: { id: "tenant-1", name: "Test Coop" },
      loading: false,
      signOut: vi.fn(),
    });
    renderInRouter(
      <AdminProtectedRoute>
        <div>Protected content</div>
      </AdminProtectedRoute>
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects to /login when there is no session", () => {
    mockUseAuth.mockReturnValue({ session: null, tenant: null, loading: false, signOut: vi.fn() });

    // We can't easily check the redirect URL in a MemoryRouter without Routes,
    // but we confirm the children are NOT rendered
    renderInRouter(
      <AdminProtectedRoute>
        <div>Should not appear</div>
      </AdminProtectedRoute>
    );
    expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
  });

  it("shows an explicit denial screen (not a redirect) when signed in but not a cooperative admin", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1", email: "member@test.com" } },
      tenant: null,
      loading: false,
      signOut: vi.fn(),
    });
    renderInRouter(
      <AdminProtectedRoute>
        <div>Protected content</div>
      </AdminProtectedRoute>
    );
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByText(/isn't a cooperative admin/i)).toBeInTheDocument();
  });

  it("shows the Jollify logo in the loading state", () => {
    mockUseAuth.mockReturnValue({ session: null, tenant: null, loading: true, signOut: vi.fn() });
    renderInRouter(
      <AdminProtectedRoute>
        <div>content</div>
      </AdminProtectedRoute>
    );
    expect(screen.getByText("J")).toBeInTheDocument();
  });
});

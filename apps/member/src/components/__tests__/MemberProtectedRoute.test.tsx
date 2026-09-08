import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mock AuthContext ───────────────────────────────────────────────────────────
const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import MemberProtectedRoute from "../MemberProtectedRoute";

const renderInRouter = (ui: React.ReactNode, initialEntry = "/member") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      {ui}
    </MemoryRouter>
  );

describe("MemberProtectedRoute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading spinner while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ session: null, member: null, loading: true, signOut: vi.fn() });
    const { container } = renderInRouter(
      <MemberProtectedRoute>
        <div>Portal content</div>
      </MemberProtectedRoute>
    );
    expect(screen.queryByText("Portal content")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders children when the user has a session and a resolved member record", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1", email: "member@test.com" } },
      member: { id: "member-1", tenantId: "tenant-1" },
      loading: false,
      signOut: vi.fn(),
    });
    renderInRouter(
      <MemberProtectedRoute>
        <div>Portal content</div>
      </MemberProtectedRoute>
    );
    expect(screen.getByText("Portal content")).toBeInTheDocument();
  });

  it("redirects to /login when there is no session", () => {
    mockUseAuth.mockReturnValue({ session: null, member: null, loading: false, signOut: vi.fn() });
    renderInRouter(
      <MemberProtectedRoute>
        <div>Should not appear</div>
      </MemberProtectedRoute>
    );
    expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
  });

  it("shows an explicit denial screen (not a redirect) when signed in but not a cooperative member", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1", email: "admin@test.com" } },
      member: null,
      loading: false,
      signOut: vi.fn(),
    });
    renderInRouter(
      <MemberProtectedRoute>
        <div>Portal content</div>
      </MemberProtectedRoute>
    );
    expect(screen.queryByText("Portal content")).not.toBeInTheDocument();
    expect(screen.getByText(/isn't a cooperative member/i)).toBeInTheDocument();
  });
});

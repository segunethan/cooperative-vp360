import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, TrendingUp, CreditCard, User, ShieldAlert, ChevronRight } from "lucide-react";
import { cn } from "@jollify/shared/lib/utils";
import { useMemberProfile } from "@/hooks/useMemberProfile";
import { useQuery } from "@tanstack/react-query";
import { fetchOwnKyc } from "@jollify/shared/lib/api/kyc";
import { SessionGuard } from "@/components/SessionGuard";

const navItems = [
  { label: "Home", icon: Home, href: "/member" },
  { label: "Products", icon: TrendingUp, href: "/member/products" },
  { label: "Loans", icon: CreditCard, href: "/member/loans" },
  { label: "Profile", icon: User, href: "/member/profile" },
];

const MemberLayout = () => {
  const location = useLocation();
  const { data: profile } = useMemberProfile();

  const { data: kyc } = useQuery({
    queryKey: ["own-kyc", profile?.memberId],
    queryFn: () => fetchOwnKyc(profile!.memberId),
    enabled: !!profile,
  });

  const isActive = (href: string) =>
    href === "/member" ? location.pathname === "/member" : location.pathname.startsWith(href);

  const onKycScreen = location.pathname === "/member/kyc";
  const showBanner = profile && !profile.kycVerified && !onKycScreen;
  const bannerText = kyc?.status === "REJECTED"
    ? "Your onboarding needs changes — tap to review"
    : kyc?.status === "PENDING"
    ? "Onboarding under review — most actions are locked until it's approved"
    : "Complete your membership onboarding to unlock the app";

  return (
    <SessionGuard>
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="border-b border-border bg-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-xs">J</span>
            </div>
            <span className="font-bold text-sm tracking-tight flex-shrink-0">Jollify</span>
            {profile && (
              <>
                <span className="text-border mx-1 hidden sm:inline">·</span>
                <span className="text-sm text-muted-foreground truncate hidden sm:inline">{profile.cooperativeName}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {showBanner && (
        <Link
          to="/member/kyc"
          className="sticky top-14 z-10 flex items-center gap-2.5 bg-amber-50 border-b border-amber-200 px-4 py-2.5 hover:bg-amber-100/70 transition-colors"
        >
          <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs font-medium text-amber-800 flex-1 max-w-3xl mx-auto">{bannerText}</p>
          <ChevronRight className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
        </Link>
      )}

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-border">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "fill-primary/10")} />
                <span className={cn("text-[11px]", active ? "font-semibold" : "font-medium")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </SessionGuard>
  );
};

export default MemberLayout;

import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@jollify/shared/lib/utils";
import {
  LayoutDashboard,
  Users,
  PiggyBank,
  CreditCard,
  TrendingUp,
  DollarSign,
  Megaphone,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { Button } from "@jollify/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jollify/shared/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";

interface CooperativeSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navigationItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/cooperative" },
  { title: "Members", icon: Users, href: "/cooperative/members" },
  { title: "Contributions & Shares", icon: PiggyBank, href: "/cooperative/contributions" },
  { title: "Loans", icon: CreditCard, href: "/cooperative/loans" },
  { title: "Products", icon: TrendingUp, href: "/cooperative/products" },
  { title: "Dividends", icon: DollarSign, href: "/cooperative/dividends" },
  { title: "Announcements", icon: Megaphone, href: "/cooperative/announcements" },
  { title: "Reports & Compliance", icon: FileText, href: "/cooperative/reports" },
  { title: "Settings", icon: Settings, href: "/cooperative/settings" },
];

export const CooperativeSidebar = ({ collapsed, onToggleCollapse }: CooperativeSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, tenant, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "??";
  const displayName = tenant?.name ?? user?.email ?? "Account";

  return (
    <div
      className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
              <span className="text-sidebar-primary-foreground font-bold text-sm tracking-tight font-display">J</span>
            </div>
            <div className="min-w-0">
              <p className="text-sidebar-foreground font-bold text-base leading-none tracking-tight font-display">Jollify</p>
              <p className="text-[11px] mt-0.5 opacity-40 truncate">Cooperative Module</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
            <span className="text-sidebar-primary-foreground font-bold text-sm font-display">J</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className={cn(
            "h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-border flex-shrink-0",
            collapsed && "mx-auto mt-3"
          )}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 px-3 mb-3">
            Main Menu
          </p>
        )}
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          const link = (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon
                className={cn(
                  "flex-shrink-0 transition-colors",
                  collapsed ? "h-5 w-5" : "h-4 w-4",
                  isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                )}
              />
              {!collapsed && <span className="truncate">{item.title}</span>}
              {!collapsed && isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary-foreground/60 flex-shrink-0" />
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.title}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 px-1 py-1">
              <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-sidebar-primary text-xs font-semibold font-display">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
                <p className="text-[11px] text-sidebar-foreground/40 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start gap-2.5 h-9 px-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent text-sm font-medium"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              Sign out
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center cursor-pointer">
                  <span className="text-sidebar-primary text-xs font-semibold font-display">{initials}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{displayName}</TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="h-8 w-8 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
};

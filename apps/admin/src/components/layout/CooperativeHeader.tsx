import { Bell, Search, ChevronRight } from "lucide-react";
import { Button } from "@jollify/shared/components/ui/button";
import { Input } from "@jollify/shared/components/ui/input";
import { Badge } from "@jollify/shared/components/ui/badge";
import { useLocation } from "react-router-dom";

const routeLabels: Record<string, string> = {
  "/cooperative": "Dashboard",
  "/cooperative/members": "Members",
  "/cooperative/contributions": "Contributions & Shares",
  "/cooperative/loans": "Loans",
  "/cooperative/dividends": "Dividends",
  "/cooperative/announcements": "Announcements",
  "/cooperative/reports": "Reports & Compliance",
  "/cooperative/settings": "Settings",
};

const getPageLabel = (pathname: string): string => {
  if (pathname.startsWith("/cooperative/members/")) return "Member Profile";
  return routeLabels[pathname] ?? "Dashboard";
};

export const CooperativeHeader = () => {
  const location = useLocation();
  const pageLabel = getPageLabel(location.pathname);
  const isSubPage = location.pathname.startsWith("/cooperative/members/");

  return (
    <header className="bg-white border-b border-border px-6 py-3.5 flex-shrink-0">
      <div className="flex items-center justify-between">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground/60">Jollify</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
          <span className="text-muted-foreground/60">Cooperative</span>
          {isSubPage && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
              <span className="text-muted-foreground/60">Members</span>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
          <span className="font-semibold text-foreground">{pageLabel}</span>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
            <Input
              placeholder="Search..."
              className="pl-9 h-8 w-56 bg-muted/40 border-border/60 text-sm focus:bg-white"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 relative text-muted-foreground hover:text-foreground">
            <Bell className="h-4 w-4" />
            <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center p-0 text-[9px] bg-destructive text-white rounded-full border-2 border-white">
              3
            </Badge>
          </Button>
        </div>
      </div>
    </header>
  );
};

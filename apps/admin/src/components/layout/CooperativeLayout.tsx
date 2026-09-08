import { useState } from "react";
import { Outlet } from "react-router-dom";
import { CooperativeSidebar } from "./CooperativeSidebar";
import { CooperativeHeader } from "./CooperativeHeader";
import { SessionGuard } from "@/components/SessionGuard";

export const CooperativeLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <SessionGuard>
      <div className="flex h-screen bg-background">
        <CooperativeSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CooperativeHeader />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SessionGuard>
  );
};
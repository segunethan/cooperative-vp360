import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AcceptInvite from "./pages/AcceptInvite";
import MemberPortal from "./pages/MemberPortal";
import NotFound from "./pages/NotFound";
import { CooperativeLayout } from "./components/layout/CooperativeLayout";
import Dashboard from "./pages/cooperative/Dashboard";
import Members from "./pages/cooperative/Members";
import MemberProfile from "./pages/cooperative/MemberProfile";
import Contributions from "./pages/cooperative/Contributions";
import Loans from "./pages/cooperative/Loans";
import Dividends from "./pages/cooperative/Dividends";
import Announcements from "./pages/cooperative/Announcements";
import Reports from "./pages/cooperative/Reports";
import Settings from "./pages/cooperative/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/member" element={<MemberPortal />} />

            <Route
              path="/cooperative"
              element={
                <ProtectedRoute>
                  <CooperativeLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="members" element={<Members />} />
              <Route path="members/:memberId" element={<MemberProfile />} />
              <Route path="contributions" element={<Contributions />} />
              <Route path="loans" element={<Loans />} />
              <Route path="dividends" element={<Dividends />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

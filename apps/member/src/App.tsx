import { Toaster } from "@jollify/shared/components/ui/toaster";
import { Toaster as Sonner } from "@jollify/shared/components/ui/sonner";
import { TooltipProvider } from "@jollify/shared/components/ui/tooltip";
import NotFound from "@jollify/shared/components/NotFound";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import MemberProtectedRoute from "@/components/MemberProtectedRoute";
import Login from "./pages/Login";
import AcceptInvite from "./pages/AcceptInvite";
import MemberPortal from "./pages/MemberPortal";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route
            path="/member"
            element={
              <MemberProtectedRoute>
                <MemberPortal />
              </MemberProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;

import { Toaster } from "@jollify/shared/components/ui/toaster";
import { Toaster as Sonner } from "@jollify/shared/components/ui/sonner";
import { TooltipProvider } from "@jollify/shared/components/ui/tooltip";
import NotFound from "@jollify/shared/components/NotFound";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import MemberProtectedRoute from "@/components/MemberProtectedRoute";
import MemberLayout from "@/components/layout/MemberLayout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvite from "./pages/AcceptInvite";
import Home from "./pages/Home";
import ProductsList from "./pages/ProductsList";
import ProductDetail from "./pages/ProductDetail";
import LoansList from "./pages/LoansList";
import LoanDetail from "./pages/LoanDetail";
import Kyc from "./pages/Kyc";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route
              path="/member"
              element={
                <MemberProtectedRoute>
                  <MemberLayout />
                </MemberProtectedRoute>
              }
            >
              <Route index element={<Home />} />
              <Route path="products" element={<ProductsList />} />
              <Route path="products/:slug" element={<ProductDetail />} />
              <Route path="loans" element={<LoansList />} />
              <Route path="loans/:id" element={<LoanDetail />} />
              <Route path="kyc" element={<Kyc />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

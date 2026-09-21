import { Toaster } from "@jollify/shared/components/ui/toaster";
import { Toaster as Sonner } from "@jollify/shared/components/ui/sonner";
import { TooltipProvider } from "@jollify/shared/components/ui/tooltip";
import NotFound from "@jollify/shared/components/NotFound";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Signup from "./pages/Signup";
import { CooperativeLayout } from "./components/layout/CooperativeLayout";
import Dashboard from "./pages/cooperative/Dashboard";
import Members from "./pages/cooperative/Members";
import MemberProfile from "./pages/cooperative/MemberProfile";
import Contributions from "./pages/cooperative/Contributions";
import Loans from "./pages/cooperative/Loans";
import Products from "./pages/cooperative/Products";
import ProductSubscribers from "./pages/cooperative/ProductSubscribers";
import Kyc from "./pages/cooperative/Kyc";
import Dividends from "./pages/cooperative/Dividends";
import Announcements from "./pages/cooperative/Announcements";
import Reports from "./pages/cooperative/Reports";
import Settings from "./pages/cooperative/Settings";
import SuperAdmin from "./pages/SuperAdmin";

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
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/super-admin" element={<SuperAdmin />} />

            <Route
              path="/cooperative"
              element={
                <AdminProtectedRoute>
                  <CooperativeLayout />
                </AdminProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="members" element={<Members />} />
              <Route path="members/:memberId" element={<MemberProfile />} />
              <Route path="contributions" element={<Contributions />} />
              <Route path="loans" element={<Loans />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:productId/subscribers" element={<ProductSubscribers />} />
              <Route path="kyc" element={<Kyc />} />
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

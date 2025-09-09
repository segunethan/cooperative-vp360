import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Users, PiggyBank, CreditCard } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to cooperative module by default
    navigate("/cooperative");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">GP</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">GreenPole</h1>
                <p className="text-xs text-muted-foreground">Financial Services Platform</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Welcome to <span className="text-primary">GreenPole</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Comprehensive financial services platform for cooperatives, share registrars, and investment management.
            </p>
          </div>

          {/* Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Cooperative Module */}
            <Card className="group hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Cooperative Module</h3>
                    <p className="text-sm text-muted-foreground">Member & financial management</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Comprehensive cooperative management system with member registration, contributions tracking, loans, and dividend distribution.
                </p>
                <Link to="/cooperative">
                  <Button className="w-full group-hover:bg-primary-hover transition-colors">
                    Access Module
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Share Registry Module (Coming Soon) */}
            <Card className="group opacity-60">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <PiggyBank className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Share Registry</h3>
                    <p className="text-sm text-muted-foreground">Stock & shareholder management</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Complete share registry management for public and private companies with dividend processing and corporate actions.
                </p>
                <Button variant="outline" className="w-full" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>

            {/* Investment Module (Coming Soon) */}
            <Card className="group opacity-60">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Investment Management</h3>
                    <p className="text-sm text-muted-foreground">Portfolio & asset management</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Professional investment management tools for fund managers and investment advisors with portfolio tracking.
                </p>
                <Button variant="outline" className="w-full" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features Highlight */}
          <div className="bg-card/50 rounded-lg p-8 border">
            <h2 className="text-2xl font-bold text-center mb-6">Platform Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium mb-2">Member Management</h3>
                <p className="text-sm text-muted-foreground">Complete member lifecycle management</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <PiggyBank className="h-6 w-6 text-success" />
                </div>
                <h3 className="font-medium mb-2">Financial Tracking</h3>
                <p className="text-sm text-muted-foreground">Real-time contribution and share monitoring</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="h-6 w-6 text-warning" />
                </div>
                <h3 className="font-medium mb-2">Loan Management</h3>
                <p className="text-sm text-muted-foreground">End-to-end loan processing and tracking</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-chart-4/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <ArrowRight className="h-6 w-6 text-chart-4" />
                </div>
                <h3 className="font-medium mb-2">Compliance</h3>
                <p className="text-sm text-muted-foreground">Automated reporting and audit trails</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 mt-16">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; 2025 GreenPole. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

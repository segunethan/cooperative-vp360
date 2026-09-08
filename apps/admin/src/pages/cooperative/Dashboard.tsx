import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import {
  Users,
  PiggyBank,
  CreditCard,
  DollarSign,
  AlertTriangle,
  Calendar
} from "lucide-react";
import { MetricCard } from "@/components/cooperative/MetricCard";
import { ActivityFeed } from "@/components/cooperative/ActivityFeed";
import { QuickActions } from "@/components/cooperative/QuickActions";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { fetchDashboardMetrics, fetchRecentActivity } from "@jollify/shared/lib/api/dashboard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const Dashboard = () => {
  const { tenant } = useAuth();

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: fetchDashboardMetrics,
    enabled: !!tenant,
    staleTime: 60_000,
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: fetchRecentActivity,
    enabled: !!tenant,
    staleTime: 30_000,
  });

  const metricCards = [
    {
      title: "Total Members",
      value: metricsLoading ? "—" : String(metrics?.totalMembers ?? 0),
      subtitle: metricsLoading ? "Loading…" : `Active: ${metrics?.activeMembers ?? 0} • Pending: ${metrics?.pendingMembers ?? 0} • Exited: ${metrics?.exitedMembers ?? 0}`,
      icon: Users,
      trend: "+0%",
      trendDirection: "up" as const,
    },
    {
      title: "Contributions Collected",
      value: metricsLoading ? "—" : (metrics?.totalContributionsYtd ?? "₦0"),
      subtitle: metricsLoading ? "Loading…" : `YTD: ${metrics?.totalContributionsYtd ?? "₦0"} • MTD: ${metrics?.mtdContributions ?? "₦0"}`,
      icon: PiggyBank,
      trend: "+0%",
      trendDirection: "up" as const,
    },
    {
      title: "Loans Outstanding",
      value: metricsLoading ? "—" : (metrics?.outstandingLoans ?? "₦0"),
      subtitle: metricsLoading ? "Loading…" : `Active portfolio: ${metrics?.outstandingLoans ?? "₦0"}`,
      icon: CreditCard,
      trend: "0%",
      trendDirection: "down" as const,
    },
    {
      title: "Dividends Paid",
      value: metricsLoading ? "—" : (metrics?.dividendsPaid ?? "₦0"),
      subtitle: "Cumulative all time",
      icon: DollarSign,
      trend: "+0%",
      trendDirection: "up" as const,
    },
  ];

  const contributionData = [
    { month: "Jan", amount: 6200000 },
    { month: "Feb", amount: 5800000 },
    { month: "Mar", amount: 7100000 },
    { month: "Apr", amount: 6500000 },
    { month: "May", amount: 8400000 },
    { month: "Jun", amount: 7900000 },
  ];

  const loanPortfolioData = [
    { name: "Personal Loans", value: 14200000, color: "hsl(42 55% 55%)" },
    { name: "Business Loans", value: 9800000, color: "hsl(42 55% 40%)" },
    { name: "Emergency Loans", value: 3100000, color: "hsl(42 55% 70%)" },
    { name: "Education Loans", value: 1600000, color: "hsl(0 0% 75%)" },
  ];

  const formatNaira = (value: number) =>
    `₦${(value / 1000000).toFixed(1)}M`;

  const recentActivities = recentActivity.length > 0
    ? recentActivity
    : [
        { id: "placeholder", type: "member" as const, message: "No recent activity yet — add members and record contributions to see activity here.", time: "now", status: "pending" as const },
      ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cooperative Dashboard</h1>
          <p className="text-muted-foreground">Overview of your cooperative's performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-success border-success">
            <div className="w-2 h-2 bg-success rounded-full mr-2"></div>
            System Online
          </Badge>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))
          : metricCards.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Contributions Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Monthly Contributions</CardTitle>
            <p className="text-xs text-muted-foreground">Jan – Jun 2025</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contributionData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatNaira}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(value: number) => [formatNaira(value), "Contributions"]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Bar dataKey="amount" fill="hsl(42 55% 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Loan Portfolio Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Loan Portfolio</CardTitle>
            <p className="text-xs text-muted-foreground">₦28.7M outstanding</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={loanPortfolioData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {loanPortfolioData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatNaira(value)]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <ActivityFeed activities={recentActivities} />
        </div>

        {/* Quick Actions */}
        <div>
          <QuickActions />
        </div>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <span>Pending Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border border-warning/20">
              <div>
                <p className="font-medium">Loan Applications</p>
                <p className="text-sm text-muted-foreground">8 applications awaiting review</p>
              </div>
              <Button variant="outline" size="sm">
                Review
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div>
                <p className="font-medium">Member Approvals</p>
                <p className="text-sm text-muted-foreground">25 members pending approval</p>
              </div>
              <Button variant="outline" size="sm">
                Approve
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div>
                <p className="font-medium">Monthly Reports</p>
                <p className="text-sm text-muted-foreground">Due in 5 days</p>
              </div>
              <Button variant="outline" size="sm">
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Upcoming Events</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">Annual General Meeting</p>
                <Badge variant="outline">15 Feb</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Annual financial review and board elections</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">Dividend Payout</p>
                <Badge variant="outline">30 Jun</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Q1 2025 dividend distribution</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">Loan Committee Meeting</p>
                <Badge variant="outline">28 Jan</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Review pending loan applications</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
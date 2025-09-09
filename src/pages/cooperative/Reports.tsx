import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  BarChart3,
  PieChart,
  TrendingUp,
  Eye
} from "lucide-react";

const Reports = () => {
  const prebuiltReports = [
    {
      name: "Monthly Contribution Summary",
      description: "Summary of all member contributions for the month",
      type: "Financial",
      frequency: "Monthly",
      lastGenerated: "Jan 01, 2025",
      status: "Ready",
    },
    {
      name: "Loan Portfolio Analysis",
      description: "Detailed analysis of loan portfolio performance",
      type: "Loans",
      frequency: "Quarterly",
      lastGenerated: "Dec 31, 2024",
      status: "Ready",
    },
    {
      name: "Member Registry Report",
      description: "Complete registry of all cooperative members",
      type: "Members",
      frequency: "On-demand",
      lastGenerated: "Jan 05, 2025",
      status: "Ready",
    },
    {
      name: "Dividend Distribution Log",
      description: "History of all dividend payments made to members",
      type: "Dividends",
      frequency: "Quarterly",
      lastGenerated: "Dec 20, 2024",
      status: "Ready",
    },
    {
      name: "Annual Financial Statement",
      description: "Comprehensive annual financial report",
      type: "Financial",
      frequency: "Annually",
      lastGenerated: "Dec 31, 2024",
      status: "Processing",
    },
  ];

  const auditLogs = [
    {
      timestamp: "Jan 08, 2025 14:32",
      user: "Admin User",
      action: "Generated Monthly Report",
      module: "Reports",
      details: "Monthly Contribution Summary - December 2024",
      ipAddress: "192.168.1.100",
    },
    {
      timestamp: "Jan 08, 2025 12:15",
      user: "Finance Officer",
      action: "Approved Loan Application",
      module: "Loans",
      details: "Loan ID: LA-2024-0156, Amount: ₦500,000",
      ipAddress: "192.168.1.105",
    },
    {
      timestamp: "Jan 08, 2025 10:45",
      user: "Admin User", 
      action: "Added New Member",
      module: "Members",
      details: "Member ID: MEM-1248, Name: Robert Johnson",
      ipAddress: "192.168.1.100",
    },
    {
      timestamp: "Jan 07, 2025 16:20",
      user: "Communications Officer",
      action: "Sent Announcement",
      module: "Announcements",
      details: "AGM Notice to 1,247 members",
      ipAddress: "192.168.1.108",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ready":
        return "bg-success/10 text-success border-success/20";
      case "Processing":
        return "bg-warning/10 text-warning border-warning/20";
      case "Failed":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted/10 text-muted-foreground border-border";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Financial":
        return "bg-primary/10 text-primary border-primary/20";
      case "Loans":
        return "bg-success/10 text-success border-success/20";
      case "Members":
        return "bg-warning/10 text-warning border-warning/20";
      case "Dividends":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted/10 text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Compliance</h1>
          <p className="text-muted-foreground">Generate reports and monitor system activity</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Report
          </Button>
          <Button size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Custom Report
          </Button>
        </div>
      </div>

      {/* Report Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reports Generated</p>
                <p className="text-2xl font-bold">47</p>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data Points</p>
                <p className="text-2xl font-bold">12.5K</p>
                <p className="text-xs text-muted-foreground">Processed today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <PieChart className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Export Formats</p>
                <p className="text-2xl font-bold">PDF/Excel</p>
                <p className="text-xs text-muted-foreground">Available formats</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Audit Entries</p>
                <p className="text-2xl font-bold">1,234</p>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Custom Report Builder */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Custom Report Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="reportType">Report Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="financial">Financial Summary</SelectItem>
                    <SelectItem value="member">Member Analysis</SelectItem>
                    <SelectItem value="loan">Loan Portfolio</SelectItem>
                    <SelectItem value="dividend">Dividend History</SelectItem>
                    <SelectItem value="activity">Activity Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dateRange">Date Range</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last7">Last 7 days</SelectItem>
                    <SelectItem value="last30">Last 30 days</SelectItem>
                    <SelectItem value="thisMonth">This month</SelectItem>
                    <SelectItem value="lastMonth">Last month</SelectItem>
                    <SelectItem value="thisQuarter">This quarter</SelectItem>
                    <SelectItem value="thisYear">This year</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="filters">Filters</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Add filters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Member Status</SelectItem>
                    <SelectItem value="amount">Amount Range</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="product">Product Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="format">Export Format</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Prebuilt Reports */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Prebuilt Reports</CardTitle>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Last Generated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prebuiltReports.map((report, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{report.name}</p>
                            <p className="text-sm text-muted-foreground">{report.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getTypeColor(report.type)}>
                            {report.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{report.frequency}</TableCell>
                        <TableCell>{report.lastGenerated}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Audit Trail</CardTitle>
            <div className="flex items-center space-x-2">
              <Input placeholder="Search audit logs..." className="w-64" />
              <Select defaultValue="all">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="members">Members</SelectItem>
                  <SelectItem value="loans">Loans</SelectItem>
                  <SelectItem value="reports">Reports</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{log.timestamp}</TableCell>
                    <TableCell>{log.user}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.module}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{log.details}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.ipAddress}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing 4 of 1,234 audit entries
            </p>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
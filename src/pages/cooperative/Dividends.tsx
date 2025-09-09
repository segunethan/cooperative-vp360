import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  DollarSign, 
  Calculator, 
  TrendingUp, 
  Plus, 
  Download,
  Eye
} from "lucide-react";

const Dividends = () => {
  const dividendHistory = [
    {
      period: "Q4 2024",
      totalAmount: "₦12,500,000",
      rate: "15%",
      payoutDate: "Dec 20, 2024",
      members: 1247,
      status: "Completed",
    },
    {
      period: "Q2 2024", 
      totalAmount: "₦8,750,000",
      rate: "12%",
      payoutDate: "Jun 15, 2024",
      members: 1205,
      status: "Completed",
    },
    {
      period: "Q4 2023",
      totalAmount: "₦11,200,000", 
      rate: "14%",
      payoutDate: "Dec 18, 2023",
      members: 1156,
      status: "Completed",
    },
  ];

  const upcomingDividend = {
    period: "Q1 2025",
    estimatedAmount: "₦15,200,000",
    eligibleMembers: 1247,
    calculationMethod: "Per Share Basis",
    proposedRate: "16%",
    targetDate: "Jun 30, 2025",
  };

  const memberEntitlements = [
    {
      memberId: "MEM-001",
      name: "John Doe",
      shareBalance: "₦180,000",
      entitlement: "₦28,800",
      paymentMethod: "Bank Transfer",
      status: "Pending",
    },
    {
      memberId: "MEM-002",
      name: "Sarah Wilson", 
      shareBalance: "₦120,000",
      entitlement: "₦19,200",
      paymentMethod: "Cash Pickup",
      status: "Pending",
    },
    {
      memberId: "MEM-004",
      name: "Emily Brown",
      shareBalance: "₦280,000",
      entitlement: "₦44,800", 
      paymentMethod: "Bank Transfer",
      status: "Pending",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-success/10 text-success border-success/20";
      case "Pending":
        return "bg-warning/10 text-warning border-warning/20";
      case "Processing":
        return "bg-primary/10 text-primary border-primary/20";
      default:
        return "bg-muted/10 text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dividends Management</h1>
          <p className="text-muted-foreground">Manage dividend declarations and distributions</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button size="sm">
            <Calculator className="h-4 w-4 mr-2" />
            Calculate Dividend
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Dividend</p>
                <p className="text-2xl font-bold">₦12.5M</p>
                <p className="text-xs text-muted-foreground">Q4 2024 - 15% rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">YTD Dividends</p>
                <p className="text-2xl font-bold">₦21.3M</p>
                <p className="text-xs text-muted-foreground">2024 Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Calculator className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Next Due</p>
                <p className="text-2xl font-bold">Jun 30</p>
                <p className="text-xs text-muted-foreground">Q1 2025 estimated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dividend Management Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Dividend Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="history" className="space-y-4">
            <TabsList>
              <TabsTrigger value="history">Dividend History</TabsTrigger>
              <TabsTrigger value="calculator">Dividend Calculator</TabsTrigger>
              <TabsTrigger value="entitlements">Member Entitlements</TabsTrigger>
            </TabsList>

            <TabsContent value="history">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Dividend History</h3>
                </div>
                
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Payout Date</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dividendHistory.map((dividend, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{dividend.period}</TableCell>
                          <TableCell className="font-medium">{dividend.totalAmount}</TableCell>
                          <TableCell>{dividend.rate}</TableCell>
                          <TableCell>{dividend.payoutDate}</TableCell>
                          <TableCell>{dividend.members.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(dividend.status)}>
                              {dividend.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="calculator">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Calculation Inputs */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Dividend Calculation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="totalProfit">Total Distributable Profit</Label>
                        <Input id="totalProfit" placeholder="₦15,200,000" />
                      </div>
                      <div>
                        <Label htmlFor="dividendRate">Dividend Rate (%)</Label>
                        <Input id="dividendRate" placeholder="16" />
                      </div>
                      <div>
                        <Label htmlFor="totalShares">Total Share Capital</Label>
                        <Input id="totalShares" placeholder="₦95,000,000" />
                      </div>
                      <Button className="w-full">
                        <Calculator className="h-4 w-4 mr-2" />
                        Calculate Entitlements
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Calculation Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Calculation Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Period:</span>
                        <span className="font-medium">{upcomingDividend.period}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Amount:</span>
                        <span className="font-medium">{upcomingDividend.estimatedAmount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Eligible Members:</span>
                        <span className="font-medium">{upcomingDividend.eligibleMembers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rate:</span>
                        <span className="font-medium">{upcomingDividend.proposedRate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Target Date:</span>
                        <span className="font-medium">{upcomingDividend.targetDate}</span>
                      </div>
                      <Button variant="outline" className="w-full mt-4">
                        Preview Entitlements
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Ready to Process?</h4>
                        <p className="text-sm text-muted-foreground">
                          Once declared, dividend entitlements will be generated for all eligible members
                        </p>
                      </div>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Declare Dividend
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="entitlements">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Member Entitlements - Q1 2025</h3>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export List
                    </Button>
                    <Button size="sm">
                      Process Payments
                    </Button>
                  </div>
                </div>
                
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Share Balance</TableHead>
                        <TableHead>Entitlement</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberEntitlements.map((member) => (
                        <TableRow key={member.memberId}>
                          <TableCell className="font-medium">{member.memberId}</TableCell>
                          <TableCell>{member.name}</TableCell>
                          <TableCell>{member.shareBalance}</TableCell>
                          <TableCell className="font-medium">{member.entitlement}</TableCell>
                          <TableCell>{member.paymentMethod}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(member.status)}>
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                              <Button variant="ghost" size="sm">
                                Process
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing 3 of 1,247 members
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
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dividends;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Settings as SettingsIcon, 
  Users, 
  Shield, 
  Plus, 
  Edit,
  Trash2,
  Key,
  Bell,
  Database
} from "lucide-react";

const Settings = () => {
  const roles = [
    {
      name: "Super Admin",
      description: "Full system access and control",
      users: 2,
      permissions: ["All Modules", "User Management", "System Configuration"],
      status: "Active",
    },
    {
      name: "Finance Officer",
      description: "Manage contributions, dividends, and financial reports",
      users: 3,
      permissions: ["Contributions", "Dividends", "Reports", "Members (Read)"],
      status: "Active",
    },
    {
      name: "Loan Officer",
      description: "Manage loan applications and portfolio",
      users: 2,
      permissions: ["Loans", "Members (Read)", "Reports (Loans)"],
      status: "Active",
    },
    {
      name: "Communications Officer",
      description: "Handle member communications and announcements",
      users: 1,
      permissions: ["Announcements", "Members (Read)"],
      status: "Active",
    },
    {
      name: "Auditor",
      description: "Read-only access to reports and audit trails",
      users: 1,
      permissions: ["Reports (Read-only)", "Audit Trail (Read-only)"],
      status: "Active",
    },
  ];

  const users = [
    {
      name: "John Admin",
      email: "john@greenpole.com",
      role: "Super Admin",
      lastLogin: "Jan 08, 2025 14:32",
      status: "Active",
    },
    {
      name: "Sarah Finance",
      email: "sarah@greenpole.com", 
      role: "Finance Officer",
      lastLogin: "Jan 08, 2025 12:15",
      status: "Active",
    },
    {
      name: "Mike Loans",
      email: "mike@greenpole.com",
      role: "Loan Officer", 
      lastLogin: "Jan 07, 2025 16:45",
      status: "Active",
    },
    {
      name: "Lisa Communications",
      email: "lisa@greenpole.com",
      role: "Communications Officer",
      lastLogin: "Jan 07, 2025 09:30",
      status: "Inactive",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-success/10 text-success border-success/20";
      case "Inactive":
        return "bg-warning/10 text-warning border-warning/20";
      case "Suspended":
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
          <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
          <p className="text-muted-foreground">Configure roles, permissions, and system preferences</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Database className="h-4 w-4 mr-2" />
            Backup Data
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Settings Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="roles" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="system">System Settings</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="roles" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Role Management</h3>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Key Permissions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm">{role.description}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{role.users}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {role.permissions.slice(0, 2).map((permission) => (
                              <Badge key={permission} variant="outline" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                            {role.permissions.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{role.permissions.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(role.status)}>
                            {role.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Shield className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">User Accounts</h3>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{user.lastLogin}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(user.status)}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <h3 className="text-lg font-medium">System Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">General Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="orgName">Organization Name</Label>
                      <Input id="orgName" defaultValue="GreenPole Cooperative Society" />
                    </div>
                    <div>
                      <Label htmlFor="currency">Default Currency</Label>
                      <Select defaultValue="ngn">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ngn">Nigerian Naira (₦)</SelectItem>
                          <SelectItem value="usd">US Dollar ($)</SelectItem>
                          <SelectItem value="eur">Euro (€)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select defaultValue="wat">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wat">West Africa Time (WAT)</SelectItem>
                          <SelectItem value="utc">UTC</SelectItem>
                          <SelectItem value="est">Eastern Time (EST)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Notification Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center">
                      <Bell className="h-4 w-4 mr-2" />
                      Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Send email notifications to admins</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>SMS Notifications</Label>
                        <p className="text-sm text-muted-foreground">Send SMS for critical alerts</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Audit Logging</Label>
                        <p className="text-sm text-muted-foreground">Log all system activities</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>

                {/* Business Rules */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Business Rules</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="minContribution">Minimum Monthly Contribution</Label>
                      <Input id="minContribution" defaultValue="₦5,000" />
                    </div>
                    <div>
                      <Label htmlFor="maxLoan">Maximum Loan Amount</Label>
                      <Input id="maxLoan" defaultValue="₦2,000,000" />
                    </div>
                    <div>
                      <Label htmlFor="dividendFreq">Dividend Frequency</Label>
                      <Select defaultValue="quarterly">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* System Maintenance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">System Maintenance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Maintenance Mode</Label>
                        <p className="text-sm text-muted-foreground">Enable for system updates</p>
                      </div>
                      <Switch />
                    </div>
                    <div>
                      <Label htmlFor="backupFreq">Auto Backup Frequency</Label>
                      <Select defaultValue="daily">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" className="w-full">
                      <Database className="h-4 w-4 mr-2" />
                      Backup Now
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline">Reset to Default</Button>
                <Button>Save Changes</Button>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <h3 className="text-lg font-medium">Security Configuration</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Password Policy */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center">
                      <Key className="h-4 w-4 mr-2" />
                      Password Policy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="minLength">Minimum Password Length</Label>
                      <Input id="minLength" type="number" defaultValue="8" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Require Uppercase</Label>
                        <p className="text-sm text-muted-foreground">At least one uppercase letter</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Require Numbers</Label>
                        <p className="text-sm text-muted-foreground">At least one number</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Require Special Characters</Label>
                        <p className="text-sm text-muted-foreground">At least one special character</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>

                {/* Session Management */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Session Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                      <Input id="sessionTimeout" type="number" defaultValue="30" />
                    </div>
                    <div>
                      <Label htmlFor="maxSessions">Max Concurrent Sessions</Label>
                      <Input id="maxSessions" type="number" defaultValue="3" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-logout Inactive Users</Label>
                        <p className="text-sm text-muted-foreground">Logout after timeout period</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
                      </div>
                      <Switch />
                    </div>
                  </CardContent>
                </Card>

                {/* Access Control */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Access Control</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="ipWhitelist">IP Whitelist</Label>
                      <Input id="ipWhitelist" placeholder="192.168.1.0/24" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Failed Login Protection</Label>
                        <p className="text-sm text-muted-foreground">Lock account after failed attempts</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div>
                      <Label htmlFor="lockoutAttempts">Max Failed Attempts</Label>
                      <Input id="lockoutAttempts" type="number" defaultValue="5" />
                    </div>
                    <div>
                      <Label htmlFor="lockoutDuration">Lockout Duration (minutes)</Label>
                      <Input id="lockoutDuration" type="number" defaultValue="15" />
                    </div>
                  </CardContent>
                </Card>

                {/* Audit Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Audit & Monitoring</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Log Login Attempts</Label>
                        <p className="text-sm text-muted-foreground">Record all login attempts</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Log Data Changes</Label>
                        <p className="text-sm text-muted-foreground">Track all data modifications</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div>
                      <Label htmlFor="logRetention">Log Retention Period (days)</Label>
                      <Input id="logRetention" type="number" defaultValue="365" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline">Reset Security Settings</Button>
                <Button>Update Security Policy</Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
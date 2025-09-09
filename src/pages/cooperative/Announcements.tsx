import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Megaphone, 
  Users, 
  Mail, 
  MessageCircle, 
  Plus, 
  Send,
  Eye,
  Edit
} from "lucide-react";

const Announcements = () => {
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    category: "",
    audience: "",
    channels: [],
    schedule: "immediate"
  });

  const announcements = [
    {
      id: "ANN-2025-001",
      title: "Annual General Meeting Notice",
      category: "AGM",
      content: "Notice of Annual General Meeting scheduled for February 15, 2025...",
      audience: "All Members",
      channels: ["Portal", "Email", "SMS"],
      status: "Delivered",
      sentDate: "Jan 08, 2025",
      deliveryRate: "98.5%",
      openRate: "76.2%",
    },
    {
      id: "ANN-2025-002", 
      title: "New Loan Product Launch",
      category: "Product",
      content: "We are excited to announce the launch of our new Education Loan product...",
      audience: "All Members",
      channels: ["Portal", "Email"],
      status: "Scheduled",
      sentDate: "Jan 15, 2025",
      deliveryRate: "-",
      openRate: "-",
    },
    {
      id: "ANN-2025-003",
      title: "System Maintenance Notice",
      category: "System",
      content: "Scheduled system maintenance on January 20, 2025 from 2:00 AM to 4:00 AM...",
      audience: "All Members", 
      channels: ["Portal", "Push"],
      status: "Draft",
      sentDate: "-",
      deliveryRate: "-",
      openRate: "-",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered":
        return "bg-success/10 text-success border-success/20";
      case "Scheduled":
        return "bg-primary/10 text-primary border-primary/20";
      case "Draft":
        return "bg-warning/10 text-warning border-warning/20";
      case "Failed":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted/10 text-muted-foreground border-border";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "AGM":
        return "bg-primary/10 text-primary border-primary/20";
      case "Product":
        return "bg-success/10 text-success border-success/20";
      case "System":
        return "bg-warning/10 text-warning border-warning/20";
      case "General":
        return "bg-muted/10 text-muted-foreground border-border";
      default:
        return "bg-muted/10 text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-muted-foreground">Communicate with your cooperative members</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Announcement
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Megaphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold">156</p>
                <p className="text-xs text-muted-foreground">This year</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Reach</p>
                <p className="text-2xl font-bold">1,205</p>
                <p className="text-xs text-muted-foreground">Active members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Mail className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open Rate</p>
                <p className="text-2xl font-bold">76.2%</p>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <MessageCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold">3</p>
                <p className="text-xs text-muted-foreground">Pending delivery</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Announcement Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Create New Announcement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input 
                  id="title" 
                  placeholder="Announcement title"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={announcementForm.category} onValueChange={(value) => setAnnouncementForm({...announcementForm, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agm">AGM</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea 
                  id="content" 
                  placeholder="Write your announcement..."
                  rows={4}
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="audience">Audience</Label>
                <Select value={announcementForm.audience} onValueChange={(value) => setAnnouncementForm({...announcementForm, audience: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    <SelectItem value="active">Active Members Only</SelectItem>
                    <SelectItem value="board">Board Members</SelectItem>
                    <SelectItem value="delinquent">Delinquent Members</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Delivery Channels</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="cursor-pointer">Portal</Badge>
                  <Badge variant="outline" className="cursor-pointer">Email</Badge>
                  <Badge variant="outline" className="cursor-pointer">SMS</Badge>
                  <Badge variant="outline" className="cursor-pointer">Push</Badge>
                </div>
              </div>

              <div>
                <Label htmlFor="schedule">Schedule</Label>
                <Select value={announcementForm.schedule} onValueChange={(value) => setAnnouncementForm({...announcementForm, schedule: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="When to send" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Send Immediately</SelectItem>
                    <SelectItem value="schedule">Schedule for Later</SelectItem>
                    <SelectItem value="draft">Save as Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex space-x-2">
                <Button variant="outline" className="flex-1">
                  Save Draft
                </Button>
                <Button className="flex-1">
                  <Send className="h-4 w-4 mr-2" />
                  Send Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Announcements List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Announcement History</CardTitle>
                <div className="flex items-center space-x-2">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
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
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent Date</TableHead>
                      <TableHead>Open Rate</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {announcements.map((announcement) => (
                      <TableRow key={announcement.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{announcement.title}</p>
                            <p className="text-sm text-muted-foreground">{announcement.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getCategoryColor(announcement.category)}>
                            {announcement.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{announcement.audience}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {announcement.channels.map((channel) => (
                              <Badge key={channel} variant="secondary" className="text-xs">
                                {channel}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(announcement.status)}>
                            {announcement.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{announcement.sentDate}</TableCell>
                        <TableCell>{announcement.openRate}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {announcement.status === "Draft" && (
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing 3 of 156 announcements
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
      </div>
    </div>
  );
};

export default Announcements;
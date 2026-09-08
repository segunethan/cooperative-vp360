import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import { Textarea } from "@jollify/shared/components/ui/textarea";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jollify/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jollify/shared/components/ui/table";
import { Megaphone, Users, Mail, MessageCircle, Send, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllAnnouncements,
  publishAnnouncement,
  saveAnnouncementAsDraft,
} from "@jollify/shared/lib/api/announcements";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const EMPTY_FORM = {
  title: "",
  content: "",
  category: "",
  audience: "",
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "Delivered": return "bg-success/10 text-success border-success/20";
    case "Scheduled": return "bg-primary/10 text-primary border-primary/20";
    case "Draft":     return "bg-warning/10 text-warning border-warning/20";
    case "Failed":    return "bg-destructive/10 text-destructive border-destructive/20";
    default:          return "bg-muted/10 text-muted-foreground border-border";
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case "AGM":     return "bg-primary/10 text-primary border-primary/20";
    case "PRODUCT": return "bg-success/10 text-success border-success/20";
    case "SYSTEM":  return "bg-warning/10 text-warning border-warning/20";
    default:        return "bg-muted/10 text-muted-foreground border-border";
  }
};

const Announcements = () => {
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: fetchAllAnnouncements,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["announcements"] });

  const publishMutation = useMutation({
    mutationFn: (publishImmediately: boolean) =>
      publishAnnouncement({
        tenantId: tenant?.id ?? "",
        createdBy: user?.id ?? "",
        title: form.title,
        content: form.content,
        category: form.category,
        audience: form.audience,
        publishImmediately,
      }),
    onSuccess: (_, publishImmediately) => {
      toast.success(publishImmediately ? "Announcement published!" : "Draft saved.");
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const draftMutation = useMutation({
    mutationFn: () =>
      saveAnnouncementAsDraft({
        tenantId: tenant?.id ?? "",
        createdBy: user?.id ?? "",
        title: form.title,
        content: form.content,
        category: form.category,
        audience: form.audience,
      }),
    onSuccess: () => {
      toast.success("Draft saved.");
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formIsValid = form.title.trim() && form.content.trim() && form.category && form.audience;
  const isBusy = publishMutation.isPending || draftMutation.isPending;

  const publishedCount = announcements.filter((a) => a.status === "Delivered").length;
  const scheduledCount = announcements.filter((a) => a.status === "Scheduled").length;
  const draftCount = announcements.filter((a) => a.status === "Draft").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-muted-foreground">Communicate with your cooperative members</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Sent", value: publishedCount, sub: "Published", icon: Megaphone, color: "primary" },
          { label: "Active Members", value: "—", sub: "Reachable", icon: Users, color: "success" },
          { label: "Drafts", value: draftCount, sub: "Not sent yet", icon: Mail, color: "warning" },
          { label: "Scheduled", value: scheduledCount, sub: "Pending delivery", icon: MessageCircle, color: "destructive" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className={`p-2 bg-${color}/10 rounded-lg`}>
                  <Icon className={`h-5 w-5 text-${color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{value}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Announcement Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Create Announcement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Announcement title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
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
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="audience">Audience</Label>
                <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
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

              <div className="flex space-x-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!formIsValid || isBusy}
                  onClick={() => draftMutation.mutate()}
                >
                  {draftMutation.isPending ? "Saving…" : "Save Draft"}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!formIsValid || isBusy}
                  onClick={() => publishMutation.mutate(true)}
                >
                  {publishMutation.isPending ? (
                    "Sending…"
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Publish Now
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Announcement History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Announcement History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : announcements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                            <Megaphone className="h-10 w-10 mb-3 opacity-30" />
                            <p className="font-medium">No announcements yet</p>
                            <p className="text-sm">Use the form on the left to publish your first message.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      announcements.map((ann) => (
                        <TableRow key={ann.id}>
                          <TableCell>
                            <p className="font-medium line-clamp-1">{ann.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{ann.content}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getCategoryColor(ann.category)}>
                              {ann.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{ann.audience}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(ann.status)}>
                              {ann.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {ann.publishedAt ?? ann.createdAt}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Announcements;

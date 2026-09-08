import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Activity, Clock } from "lucide-react";
import { cn } from "@jollify/shared/lib/utils";

interface ActivityItem {
  type: string;
  message: string;
  time: string;
  status: "completed" | "pending" | "failed";
}

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export const ActivityFeed = ({ activities }: ActivityFeedProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-success border-success/20 bg-success/10";
      case "pending":
        return "text-warning border-warning/20 bg-warning/10";
      case "failed":
        return "text-destructive border-destructive/20 bg-destructive/10";
      default:
        return "text-muted-foreground border-border bg-muted/10";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-primary" />
          <span>Recent Activity</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={index} className="flex items-start space-x-4 p-3 rounded-lg border bg-card">
              <div className="flex-shrink-0 mt-1">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground mb-1">
                  {activity.message}
                </p>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{activity.time}</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getStatusColor(activity.status))}
                  >
                    {activity.status}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <button className="text-sm text-primary hover:underline">
            View all activities →
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
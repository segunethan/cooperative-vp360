import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { 
  UserPlus, 
  DollarSign, 
  Megaphone, 
  FileText, 
  Plus, 
  Zap 
} from "lucide-react";

export const QuickActions = () => {
  const actions = [
    {
      title: "Add Member",
      description: "Register a new cooperative member",
      icon: UserPlus,
      variant: "default" as const,
    },
    {
      title: "Declare Dividend",
      description: "Start dividend calculation and distribution",
      icon: DollarSign,
      variant: "outline" as const,
    },
    {
      title: "Post Announcement",
      description: "Send notification to all members",
      icon: Megaphone,
      variant: "outline" as const,
    },
    {
      title: "Generate Report",
      description: "Create compliance or financial report",
      icon: FileText,
      variant: "outline" as const,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Zap className="h-5 w-5 text-primary" />
          <span>Quick Actions</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant}
              className="w-full justify-start h-auto p-4"
            >
              <div className="flex items-center space-x-3 text-left">
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">{action.title}</p>
                  <p className="text-xs opacity-80">{action.description}</p>
                </div>
              </div>
            </Button>
          );
        })}
        
        <div className="pt-3 border-t">
          <Button variant="ghost" className="w-full justify-start" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            More Actions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
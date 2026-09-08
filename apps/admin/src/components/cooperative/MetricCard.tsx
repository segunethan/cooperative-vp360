import { Card, CardContent } from "@jollify/shared/components/ui/card";
import { Badge } from "@jollify/shared/components/ui/badge";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@jollify/shared/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  trend: string;
  trendDirection: "up" | "down";
}

export const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendDirection 
}: MetricCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              "flex items-center space-x-1",
              trendDirection === "up" 
                ? "text-success border-success/20 bg-success/10" 
                : "text-destructive border-destructive/20 bg-destructive/10"
            )}
          >
            {trendDirection === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span className="text-xs">{trend}</span>
          </Badge>
        </div>
        
        <div className="space-y-2">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
};
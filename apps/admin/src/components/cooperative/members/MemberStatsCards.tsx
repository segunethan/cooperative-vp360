import { Card, CardContent } from "@jollify/shared/components/ui/card";
import { Users, UserCheck, Clock, UserX } from "lucide-react";

interface MemberStats {
  total: number;
  active: number;
  pending: number;
  exited: number;
}

const MemberStatsCards = ({ stats }: { stats: MemberStats }) => {
  const cards = [
    { label: "Total Members", value: stats.total, icon: Users, color: "text-primary" },
    { label: "Active", value: stats.active, icon: UserCheck, color: "text-success" },
    { label: "Pending Approval", value: stats.pending, icon: Clock, color: "text-warning" },
    { label: "Exited", value: stats.exited, icon: UserX, color: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MemberStatsCards;

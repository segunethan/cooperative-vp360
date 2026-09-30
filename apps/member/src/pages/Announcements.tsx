import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { fetchMemberAnnouncements } from "@jollify/shared/lib/api/announcements";
import { useMemberProfile } from "@/hooks/useMemberProfile";

const CATEGORY_COLOR: Record<string, string> = {
  AGM: "bg-primary/10 text-primary border-primary/20",
  PRODUCT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SYSTEM: "bg-amber-50 text-amber-700 border-amber-200",
  EVENT: "bg-blue-50 text-blue-700 border-blue-200",
  GENERAL: "bg-muted/50 text-muted-foreground border-border",
};

const Announcements = () => {
  const { data: profile } = useMemberProfile();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["member-announcements", profile?.tenantId],
    queryFn: () => fetchMemberAnnouncements(),
    enabled: !!profile,
  });

  // "active"-audience announcements only show to active members; every
  // other audience value (all, board, delinquent) is shown to everyone,
  // since this app has no board/delinquency classification on members yet.
  const visible = announcements.filter((a) => a.audience !== "active" || profile?.status === "ACTIVE");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Announcements</h1>
        <p className="text-sm text-muted-foreground">Updates from {profile?.cooperativeName ?? "your cooperative"}.</p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <Megaphone className="h-8 w-8 opacity-30" />
          No announcements yet.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-border p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CATEGORY_COLOR[a.category] ?? CATEGORY_COLOR.GENERAL}`}>
                  {a.category}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">{a.title}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Announcements;

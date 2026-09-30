import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";

export interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  category: string;
  audience: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  createdBy: string | null;
}

export interface PublishAnnouncementData {
  tenantId: string;
  createdBy: string;
  title: string;
  content: string;
  category: string;
  audience: string;
  publishImmediately: boolean;
}

const toDisplayStatus = (s: string) => ({
  PUBLISHED: "Delivered",
  DRAFT:     "Draft",
  SCHEDULED: "Scheduled",
  ARCHIVED:  "Archived",
}[s] ?? s);

const toDisplayAudience = (s: string) => ({
  all:         "All Members",
  active:      "Active Members",
  board:       "Board Members",
  delinquent:  "Delinquent Members",
}[s] ?? s);

const toAnnouncementRow = (row: Record<string, unknown>): AnnouncementRow => ({
  id: row.id as string,
  title: row.title as string,
  content: row.content as string,
  category: ((row.category as string) ?? "").toUpperCase(),
  audience: toDisplayAudience(row.audience as string),
  status: toDisplayStatus(row.status as string),
  createdAt: new Date(row.created_at as string).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }),
  publishedAt: row.published_at
    ? new Date(row.published_at as string).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null,
  createdBy: row.created_by as string | null,
});

// ── Reads ────────────────────────────────────────────────────────────────────

export const fetchAllAnnouncements = async (): Promise<AnnouncementRow[]> => {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) handleSupabaseError(error);
  return (data ?? []).map(toAnnouncementRow);
};

// ── Writes ───────────────────────────────────────────────────────────────────

export const publishAnnouncement = async (data: PublishAnnouncementData): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase.from("announcements").insert({
    tenant_id: data.tenantId,
    created_by: data.createdBy,
    title: data.title.trim(),
    content: data.content.trim(),
    category: data.category.toLowerCase(),
    audience: data.audience,
    status: data.publishImmediately ? "PUBLISHED" : "DRAFT",
    published_at: data.publishImmediately ? now : null,
  });
  if (error) handleSupabaseError(error);
};

export const saveAnnouncementAsDraft = async (
  data: Omit<PublishAnnouncementData, "publishImmediately">
): Promise<void> => {
  const { error } = await supabase.from("announcements").insert({
    tenant_id: data.tenantId,
    created_by: data.createdBy,
    title: data.title.trim(),
    content: data.content.trim(),
    category: data.category.toLowerCase(),
    audience: data.audience,
    status: "DRAFT",
    published_at: null,
  });
  if (error) handleSupabaseError(error);
};

// ── Member-facing read ──────────────────────────────────────────────────────

export interface MemberAnnouncement {
  id: string;
  title: string;
  content: string;
  category: string;
  audience: string;
  publishedAt: string;
}

// RLS (announcements_member_select) already scopes this to the member's own
// tenant; we additionally filter to PUBLISHED here since a member should
// never see a draft.
export const fetchMemberAnnouncements = async (limit = 20): Promise<MemberAnnouncement[]> => {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, content, category, published_at, audience")
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) handleSupabaseError(error);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    category: ((row.category as string) ?? "general").toUpperCase(),
    audience: (row.audience as string) ?? "all",
    publishedAt: row.published_at as string,
  }));
};

export const deleteAnnouncementDraft = async (announcementId: string): Promise<void> => {
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", announcementId)
    .eq("status", "DRAFT");
  if (error) handleSupabaseError(error);
};

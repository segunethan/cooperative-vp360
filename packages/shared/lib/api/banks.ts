import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";

export interface Bank {
  id: string;
  name: string;
}

export const fetchBanks = async (): Promise<Bank[]> => {
  const { data, error } = await supabase.from("banks").select("id, name").order("name", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
};

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function getCompanyFromParams(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("gsi000_params")
    .select("txgsi000_compnr, created_at")
    .not("txgsi000_compnr", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error("company_query_failed");
  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  const company = (row?.txgsi000_compnr || "").toString().trim();

  if (!company) throw new Error("no_company_config");
  return company;
}
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { getCompanyFromParams } from "../_shared/company.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : `${pu}/`;
  return base + ot.replace(/^\//, "");
}

function toAbsoluteUrl(base: string, maybeUrl: string) {
  const value = `${maybeUrl || ""}`;
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${base}${value}`;
  return `${base}/${value}`;
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: {
      planningGroup?: string;
      vehicleId?: string;
      language?: string;
      company?: string;
      showAll?: boolean;
    } = {};

    try {
      body = await req.json();
    } catch {
      console.warn("[ln-transport-planning-list] invalid_json");
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const planningGroup = (body.planningGroup || "").trim();
    const vehicleId = (body.vehicleId || "").trim();
    const language = body.language || "en-US";
    const showAll = body.showAll === true;

    console.info("[ln-transport-planning-list] request", {
      planningGroup,
      vehicleId,
      language,
      showAll,
    });

    if (!showAll && !planningGroup) {
      console.warn("[ln-transport-planning-list] missing_group");
      return json({ ok: false, error: "missing_group" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-transport-planning-list] env_missing");
      return json({ ok: false, error: "env_missing" }, 200);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = await getCompanyFromParams(supabase);

    const { data: cfgData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) {
      console.error("[ln-transport-planning-list] config_error", { message: cfgErr.message });
      return json({ ok: false, error: "config_error" }, 200);
    }

    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) {
      console.warn("[ln-transport-planning-list] no_active_config");
      return json({ ok: false, error: "no_active_config" }, 200);
    }

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string;
      cs: string;
      pu: string;
      ot: string;
      grant_type: string;
      saak: string;
      sask: string;
    };

    const { data: activeRow, error: activeErr } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (activeErr || !activeRow) {
      console.error("[ln-transport-planning-list] config_lookup_error", {
        message: activeErr?.message || null,
      });
      return json({ ok: false, error: "config_lookup_error" }, 200);
    }

    const grantType = grant_type === "password_credentials" ? "password" : grant_type;
    const basic = btoa(`${ci}:${cs}`);
    const tokenParams = new URLSearchParams();
    tokenParams.set("grant_type", grantType);
    tokenParams.set("username", saak);
    tokenParams.set("password", sask);

    const tokenRes = await fetch(buildTokenUrl(pu, ot), {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    }).catch(() => null as Response | null);

    if (!tokenRes) {
      console.error("[ln-transport-planning-list] token_network_error");
      return json({ ok: false, error: "token_network_error" }, 200);
    }

    const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string; error_description?: string } | null;
    if (!tokenRes.ok || !tokenJson?.access_token) {
      console.error("[ln-transport-planning-list] token_error", {
        status: tokenRes.status,
        message: tokenJson?.error_description || null,
      });
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }

    const accessToken = tokenJson.access_token;
    const base = activeRow.iu.endsWith("/") ? activeRow.iu.slice(0, -1) : activeRow.iu;
    const path = `/${activeRow.ti}/LN/lnapi/odata/txgwi.TransportPlanning/GWITransportPlannings`;

    const escapedGroup = planningGroup.replace(/'/g, "''");
    const escapedVehicle = vehicleId.replace(/'/g, "''");
    const filterParts: string[] = [];

    if (!showAll) {
      filterParts.push(`PlanningGroupTransport eq '${escapedGroup}'`);
    }

    if (vehicleId) {
      filterParts.push(`PlannedVehicle eq '${escapedVehicle}'`);
    }

    const query = new URLSearchParams({
      "$count": "true",
      "$select": "*",
    });

    if (filterParts.length > 0) {
      query.set("$filter", filterParts.join(" and "));
    }

    console.info("[ln-transport-planning-list] filter", {
      filter: query.get("$filter") || null,
    });

    const headers = {
      accept: "application/json",
      "Content-Language": language,
      "X-Infor-LnCompany": company,
      Authorization: `Bearer ${accessToken}`,
    } as const;

    let nextUrl = `${base}${path}?${query.toString()}`;
    let count = 0;
    const all: any[] = [];

    for (let i = 0; i < 50 && nextUrl; i += 1) {
      const odataRes = await fetch(nextUrl, { method: "GET", headers }).catch(() => null as Response | null);
      if (!odataRes) {
        console.error("[ln-transport-planning-list] odata_network_error", { nextUrl });
        return json({ ok: false, error: "odata_network_error" }, 200);
      }

      const odataJson = (await odataRes.json().catch(() => null)) as any;
      if (!odataRes.ok || !odataJson) {
        const top = odataJson?.error?.message || "odata_error";
        const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
        console.error("[ln-transport-planning-list] odata_error", {
          status: odataRes.status,
          message: top,
          detailsCount: details.length,
        });
        return json({ ok: false, error: { message: top, details } }, 200);
      }

      if (i === 0) {
        count = odataJson["@odata.count"] ?? 0;
      }

      const pageItems = Array.isArray(odataJson.value) ? odataJson.value : [];
      all.push(...pageItems);

      const nextLink = (odataJson["@odata.nextLink"] || odataJson["odata.nextLink"] || "") as string;
      nextUrl = nextLink ? toAbsoluteUrl(base, nextLink) : "";

      if (count && all.length >= count) {
        break;
      }
    }

    const items = all.map((value: any) => ({
      TransportID: value?.TransportID ?? "",
      TransportType: value?.TransportType ?? "",
      Item: value?.Item ?? "",
      HandlingUnit: value?.HandlingUnit ?? "",
      Warehouse: value?.Warehouse ?? "",
      LocationFrom: value?.LocationFrom ?? "",
      LocationTo: value?.LocationTo ?? "",
      VehicleID: value?.VehicleID ?? "",
      PlannedVehicle: value?.PlannedVehicle ?? "",
      PlannedDeliveryDate: value?.PlannedDeliveryDate ?? "",
      PlanningGroupTransport: value?.PlanningGroupTransport ?? "",
      Description: value?.Description ?? "",
    }));

    console.info("[ln-transport-planning-list] completed", {
      count,
      items: items.length,
    });

    return json({ ok: true, count, items }, 200);
  } catch (error) {
    console.error("[ln-transport-planning-list] unhandled", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: "unhandled" }, 200);
  }
});

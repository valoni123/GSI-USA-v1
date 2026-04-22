import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessToken, getIonApiConfig } from "../_shared/ionapi.ts";
import { createServiceRoleClient, getCorsHeaders, json, requireGsiSession, requirePermissions } from "../_shared/auth.ts";

type RequestBody = {
  plannedVehicle?: string;
  language?: string;
  company?: string;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createServiceRoleClient();
    const auth = await requireGsiSession(req, supabase);
    if (!auth.ok) {
      return auth.response;
    }

    const permissionResponse = requirePermissions(req, auth.user, ["trans", "trlo", "trul"]);
    if (permissionResponse) {
      return permissionResponse;
    }

    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      console.error("[ln-assign-transport-orders] invalid json body");
      return json(req, { ok: false, error: "invalid_json" }, 200);
    }

    const plannedVehicle = (body.plannedVehicle || "").trim();
    const language = (body.language || "en-US").trim() || "en-US";

    if (!plannedVehicle) {
      console.warn("[ln-assign-transport-orders] missing plannedVehicle");
      return json(req, { ok: false, error: "missing_planned_vehicle" }, 200);
    }

    const company = (body.company || "").trim() || (await getCompanyFromParams(supabase));
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    const url = `${base}/${cfg.ti}/LN/lnapi/odata/txgwi.TransportAssignments/AssignTransportOrderToVehilces?$select=*`;

    console.info("[ln-assign-transport-orders] start", { plannedVehicle, language, company, sessionUser: auth.gsiUserId });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ PlannedVehicle: plannedVehicle }),
    });

    const payload = (await response.json().catch(() => null)) as any;

    if (!response.ok || !payload) {
      const top = payload?.error?.message || "assignment_failed";
      const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
      console.error("[ln-assign-transport-orders] upstream error", {
        status: response.status,
        message: top,
        details,
      });
      return json(req, { ok: false, error: { message: top, details } }, 200);
    }

    console.info("[ln-assign-transport-orders] completed", { plannedVehicle });
    return json(req, { ok: true, data: payload }, 200);
  } catch (error) {
    console.error("[ln-assign-transport-orders] unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json(req, { ok: false, error: { message: "unhandled" } }, 200);
  }
});

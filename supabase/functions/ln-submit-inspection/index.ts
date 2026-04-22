import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCompanyFromParams } from "../_shared/company.ts";
import { createServiceRoleClient, getCorsHeaders, json, requireGsiSession, requirePermissions } from "../_shared/auth.ts";

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : `${pu}/`;
  return base + ot.replace(/^\//, "");
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    const supabase = createServiceRoleClient();
    const auth = await requireGsiSession(req, supabase);
    if (!auth.ok) {
      return auth.response;
    }

    const permissionResponse = requirePermissions(req, auth.user, ["insp"]);
    if (permissionResponse) {
      return permissionResponse;
    }

    let body: {
      language?: string;
      company?: string;
      payload?: {
        TransactionID: string;
        Inspection: string;
        InspectionSequence: number;
        InspectionLine: number;
        OrderOrigin: string;
        Order: string;
        Position: number;
        Sequence: number;
        Set: number;
        Quantity: number;
        QuantityApproved: number;
        QuantityRejected: number;
        RejectReason?: string;
        Approve: string;
        Employee: string;
        FromAPI: string;
        Unit: string;
      };
    } = {};
    try {
      body = await req.json();
    } catch {
      return json(req, { ok: false, error: "invalid_json" }, 200);
    }

    const language = body.language || "en-US";
    const companyOverride = (body.company || "").toString().trim();
    const payload = body.payload;
    if (!payload || typeof payload !== "object") {
      return json(req, { ok: false, error: "missing_payload" }, 200);
    }

    const required = [
      "Inspection", "InspectionSequence", "InspectionLine",
      "OrderOrigin", "Order", "Position", "Sequence", "Set",
      "Quantity", "QuantityApproved", "QuantityRejected",
      "Approve", "Employee", "FromAPI", "Unit",
    ];
    const missing = required.filter((key) => payload[key as keyof typeof payload] === undefined || payload[key as keyof typeof payload] === null);
    if (missing.length) {
      return json(req, { ok: false, error: "missing_fields", fields: missing }, 200);
    }

    const company = companyOverride || await getCompanyFromParams(supabase);

    const { data: cfgData } = await supabase.rpc("get_active_ionapi");
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json(req, { ok: false, error: "no_active_config" }, 200);

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    const { data: activeRow } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!activeRow) return json(req, { ok: false, error: "no_active_config_row" }, 200);
    const iu: string = activeRow.iu;
    const ti: string = activeRow.ti;

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
    }).catch(() => null as unknown as Response);
    if (!tokenRes) return json(req, { ok: false, error: "token_network_error" }, 200);
    const tokenJson = await tokenRes.json().catch(() => null) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      return json(req, { ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const url = `${base}/${ti}/LN/lnapi/odata/txgsi.GSIInspection/GSIInspections?$select=*`;

    const postRes = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch(() => null as unknown as Response);

    if (!postRes) return json(req, { ok: false, error: "post_network_error" }, 200);

    const contentType = postRes.headers.get("Content-Type") || "";
    const responseBody = contentType.includes("application/json")
      ? await postRes.json().catch(() => null)
      : await postRes.text().catch(() => null);

    if (!postRes.ok) {
      const topMessage = (responseBody as any)?.error?.message || "post_error";
      const details = Array.isArray((responseBody as any)?.error?.details) ? (responseBody as any).error.details : [];
      return json(req, { ok: false, error: { message: topMessage, details }, status: postRes.status, body: responseBody }, 200);
    }

    return json(req, { ok: true, status: postRes.status, body: responseBody }, 200);
  } catch (error) {
    console.error("[ln-submit-inspection] unhandled", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json(req, { ok: false, error: { message: "unhandled" } }, 200);
  }
});

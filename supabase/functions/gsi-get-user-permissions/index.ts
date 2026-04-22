import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createServiceRoleClient, getCorsHeaders, json, requireGsiSession } from "../_shared/auth.ts";

const toBool = (value: unknown) => value === true || String(value ?? "").toLowerCase() === "true";

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

    const permissions = {
      admin: toBool(auth.user.admin),
      rece: toBool(auth.user.rece),
      insp: toBool(auth.user.insp),
      itif: toBool(auth.user.itif),
      huif: toBool(auth.user.huif),
      corr: toBool(auth.user.corr),
      trans: toBool(auth.user.trans),
      cntg: toBool(auth.user.cntg),
      pick: toBool(auth.user.pick),
      rele: toBool(auth.user.rele),
      load: toBool(auth.user.load),
      ship: toBool(auth.user.ship),
      trlo: toBool(auth.user.trlo),
      trul: toBool(auth.user.trul),
    };

    return json(req, { ok: true, permissions }, 200);
  } catch (error) {
    console.error("[gsi-get-user-permissions] unhandled", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json(req, { ok: false, error: "unhandled" }, 500);
  }
});

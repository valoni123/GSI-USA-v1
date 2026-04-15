import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getIonApiAccessToken } from "../_shared/ionapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUEST_TIMEOUT_MS = 15000;

type RequestBody = {
  item?: string;
};

type IdmResource = {
  name?: string;
  mimetype?: string;
  filename?: string;
  url?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toText(value: unknown) {
  return value == null ? "" : String(value);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function pickMainPdfResource(resources: IdmResource[]) {
  return (
    resources.find((resource) => toText(resource?.name).trim() === "") ||
    resources.find((resource) => toText(resource?.mimetype).toLowerCase() === "application/pdf") ||
    null
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      console.error("[ln-idm-item-drawing] invalid json body");
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const item = toText(body.item);
    if (!item) {
      console.warn("[ln-idm-item-drawing] missing item");
      return json({ ok: false, error: "missing_item" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-idm-item-drawing] missing env");
      return json({ ok: false, error: "env_missing" }, 200);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const accessToken = await getIonApiAccessToken(supabase);

    const { data, error } = await supabase
      .from("gsi000_params")
      .select("txgsi000_dmsu, created_at")
      .not("txgsi000_dmsu", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[ln-idm-item-drawing] dms url query failed", { error: error.message });
      return json({ ok: false, error: "dms_url_query_failed" }, 200);
    }

    const dmsBaseUrl = toText(data?.[0]?.txgsi000_dmsu).trim().replace(/\/+$/, "");
    if (!dmsBaseUrl) {
      console.error("[ln-idm-item-drawing] missing dms url config");
      return json({ ok: false, error: "dms_url_missing" }, 200);
    }

    const escapedItem = item.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const params = new URLSearchParams();
    params.set("$query", `/Item[@Item_ItemNumber = "${escapedItem}"] `);
    params.set("$offset", "0");
    params.set("$limit", "0");
    params.set("$includeCount", "true");
    params.set("$state", "0");

    const url = `${dmsBaseUrl}/items/search?${params.toString()}`;
    console.info("[ln-idm-item-drawing] requesting idm item drawing", { item: item.trim() || item });

    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      },
      REQUEST_TIMEOUT_MS,
    );

    const payload = (await response.json().catch(() => null)) as any;
    if (!response.ok || !payload) {
      console.error("[ln-idm-item-drawing] idm upstream error", {
        status: response.status,
        item: item.trim() || item,
      });
      return json({ ok: false, error: "idm_upstream_error" }, 200);
    }

    const itemsNode = payload?.items;
    const firstItem = asArray(itemsNode?.item)[0] as any;
    if (!firstItem) {
      console.info("[ln-idm-item-drawing] no drawing found", { item: item.trim() || item });
      return json({ ok: true, found: false }, 200);
    }

    const resources = asArray<IdmResource>(firstItem?.resrs?.res);
    const mainResource = pickMainPdfResource(resources);
    if (!mainResource?.url) {
      console.info("[ln-idm-item-drawing] no pdf resource found", { item: item.trim() || item });
      return json({ ok: true, found: false }, 200);
    }

    const pdfResponse = await fetchWithTimeout(
      toText(mainResource.url),
      {
        method: "GET",
        headers: {
          accept: "application/pdf",
        },
      },
      REQUEST_TIMEOUT_MS,
    );

    if (!pdfResponse.ok) {
      console.error("[ln-idm-item-drawing] pdf download failed", {
        status: pdfResponse.status,
        item: item.trim() || item,
      });
      return json({ ok: false, error: "idm_pdf_download_failed" }, 200);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    return json(
      {
        ok: true,
        found: true,
        pdfBase64: arrayBufferToBase64(pdfBuffer),
        mimeType: toText(mainResource.mimetype) || "application/pdf",
        filename: toText(mainResource.filename) || toText(firstItem?.displayName),
        itemNumber: item,
        displayName: toText(firstItem?.displayName),
        drillbackUrl: toText(firstItem?.drillbackurl),
      },
      200,
    );
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    console.error("[ln-idm-item-drawing] unhandled error", {
      isTimeout,
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: isTimeout ? "idm_timeout" : "idm_unhandled_error" }, 200);
  }
});
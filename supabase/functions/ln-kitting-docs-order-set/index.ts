import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessToken, getIonApiConfig } from "../_shared/ionapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUEST_TIMEOUT_MS = 15000;
const ITEM_SELECT = "Description,CreationDate,LastModificationDate,ListType,InventoryUnit,LotControlled,Material,Size,Weight,WeightUnit,ProductType,ProductClass,ProductLine,CriticalSafetyItem,FloorStock,ItemText";

type RequestBody = {
  order?: string;
  set?: string | number;
  orderOrigin?: string;
  company?: string;
};

type ItemDetails = {
  description: string;
  inventoryUnit: string;
  creationDate: string;
  lastModificationDate: string;
};

type SalesOrderLineDetails = {
  shiptoBusinessPartner: string;
  shiptoAddress: string;
  listGroup: string;
  rushOrderLine: string;
  orderLineText: string | null;
  escalationComment: string | null;
  escalationLevel: string;
};

type ListComponentDetails = {
  commentsInstructions: string;
  drawingOnFile: string;
};

type GroupedComponent = {
  orderOrigin: string;
  order: string;
  line: number;
  sequence: number;
  set: number;
  bomLine: number;
  component: string;
  componentRaw: string;
  warehouse: string;
  quantity: number;
  orderedQuantity: number;
  originallyOrderedQuantity: number;
  description: string;
  inventoryUnit: string;
  commentsInstructions: string;
  drawingOnFile: string;
};

type GroupedLine = {
  orderOrigin: string;
  order: string;
  set: number;
  line: number;
  sequence: number;
  item: string;
  itemRaw: string;
  itemDescription: string;
  itemCreationDate: string;
  itemLastModificationDate: string;
  shippingWarehouse: string;
  orderUnit: string;
  orderedQuantity: number;
  originallyOrderedQuantity: number;
  lineStatus: string;
  rushOrder: string;
  salesOrderLineDetails: SalesOrderLineDetails;
  components: GroupedComponent[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toText(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function toRawText(value: unknown) {
  return value == null ? "" : String(value);
}

function toNullableText(value: unknown) {
  return value == null ? null : String(value).trim();
}

function lineKey(row: any) {
  return [
    toText(row?.OrderOrigin),
    toText(row?.Order),
    toNumber(row?.Line),
    toNumber(row?.Sequence),
    toNumber(row?.Set),
  ].join("|");
}

function componentKey(row: any) {
  return [
    toText(row?.OrderOrigin),
    toText(row?.Order),
    toNumber(row?.Line),
    toNumber(row?.Sequence),
    toNumber(row?.Set),
    toNumber(row?.BOMLine),
    toText(row?.Component),
  ].join("|");
}

function listComponentLookupKey(lineLookupKey: string, bomLine: number) {
  return [lineLookupKey, bomLine].join("|");
}

async function fetchJson(url: string, accessToken: string, company: string) {
  return fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        "Content-Language": "en-US",
        "X-Infor-LnCompany": company,
        Authorization: `Bearer ${accessToken}`,
      },
    },
    REQUEST_TIMEOUT_MS,
  );
}

async function fetchItemDetails(
  base: string,
  tenant: string,
  accessToken: string,
  company: string,
  item: string,
): Promise<ItemDetails> {
  const escapedItem = item.replace(/'/g, "''");
  const params = new URLSearchParams();
  params.set("$filter", `Item eq '${escapedItem}'`);
  params.set("$select", ITEM_SELECT);

  const url = `${base}/${tenant}/LN/lnapi/odata/tcapi.ibdItem/Items?${params.toString()}`;
  console.info("[ln-kitting-docs-order-set] requesting item details", { item: toText(item) || item });

  const response = await fetchJson(url, accessToken, company);
  const payload = (await response.json().catch(() => null)) as any;
  if (!response.ok || !payload) {
    console.error("[ln-kitting-docs-order-set] item details upstream error", {
      status: response.status,
      item: toText(item) || item,
      error: payload?.error?.message || "odata_error",
    });
    return { description: "", inventoryUnit: "", creationDate: "", lastModificationDate: "" };
  }

  const row = Array.isArray(payload.value) ? payload.value[0] : null;
  return {
    description: toText(row?.Description),
    inventoryUnit: toText(row?.InventoryUnit),
    creationDate: toText(row?.CreationDate),
    lastModificationDate: toText(row?.LastModificationDate),
  };
}

async function fetchSalesOrderLineDetails(
  base: string,
  tenant: string,
  accessToken: string,
  company: string,
  order: string,
  line: number,
  sequence: number,
): Promise<SalesOrderLineDetails> {
  const escapedOrder = order.replace(/'/g, "''");
  const params = new URLSearchParams();
  params.set("$filter", `SalesOrder eq '${escapedOrder}' and Line eq ${line} and SequenceNumber eq ${sequence}`);
  params.set(
    "$select",
    "ShiptoBusinessPartner,ShiptoAddress,ListGroup,RushOrderLine,OrderLineText,EscalationComment,EscalationLevel",
  );

  const url = `${base}/${tenant}/LN/lnapi/odata/txgwi.OutboundOrderLines/SalesOrderLines?${params.toString()}`;
  console.info("[ln-kitting-docs-order-set] requesting sales order line details", { order, line, sequence });

  const response = await fetchJson(url, accessToken, company);
  const payload = (await response.json().catch(() => null)) as any;
  if (!response.ok || !payload) {
    console.error("[ln-kitting-docs-order-set] sales order line details upstream error", {
      status: response.status,
      order,
      line,
      sequence,
      error: payload?.error?.message || "odata_error",
    });
    return {
      shiptoBusinessPartner: "",
      shiptoAddress: "",
      listGroup: "",
      rushOrderLine: "",
      orderLineText: null,
      escalationComment: null,
      escalationLevel: "",
    };
  }

  const row = Array.isArray(payload.value) ? payload.value[0] : null;
  return {
    shiptoBusinessPartner: toText(row?.ShiptoBusinessPartner),
    shiptoAddress: toText(row?.ShiptoAddress),
    listGroup: toText(row?.ListGroup),
    rushOrderLine: toText(row?.RushOrderLine),
    orderLineText: toNullableText(row?.OrderLineText),
    escalationComment: toNullableText(row?.EscalationComment),
    escalationLevel: toText(row?.EscalationLevel),
  };
}

async function fetchListComponentDetails(
  base: string,
  tenant: string,
  accessToken: string,
  company: string,
  listGroup: string,
  item: string,
  sequenceNumber: number,
): Promise<ListComponentDetails> {
  const escapedListGroup = listGroup.replace(/'/g, "''");
  const escapedItem = item.replace(/'/g, "''");
  const entityPath = `ListComponents(ListGroup='${escapedListGroup}',Item='${escapedItem}',ListType=txgwi.OutboundOrderLines.ListType'Kit',SequenceNumber=${sequenceNumber})`;
  const url = `${base}/${tenant}/LN/lnapi/odata/txgwi.OutboundOrderLines/${encodeURI(entityPath)}?$select=*`;

  console.info("[ln-kitting-docs-order-set] requesting list component details", {
    listGroup,
    item: toText(item) || item,
    sequenceNumber,
  });

  const response = await fetchJson(url, accessToken, company);
  const payload = (await response.json().catch(() => null)) as any;
  if (!response.ok || !payload) {
    console.error("[ln-kitting-docs-order-set] list component details upstream error", {
      status: response.status,
      listGroup,
      item: toText(item) || item,
      sequenceNumber,
      error: payload?.error?.message || "odata_error",
    });
    return {
      commentsInstructions: "",
      drawingOnFile: "",
    };
  }

  return {
    commentsInstructions: toText(payload?.CommentsInstructions),
    drawingOnFile: toText(payload?.DrawingOnFile),
  };
}

async function fetchOutboundOrderLines(
  base: string,
  tenant: string,
  accessToken: string,
  company: string,
  order: string,
  setValue: number,
  orderOrigin: string,
) {
  const escapedOrder = order.replace(/'/g, "''");
  const escapedOrderOrigin = orderOrigin.replace(/'/g, "''");
  const params = new URLSearchParams();
  params.set(
    "$filter",
    `Order eq '${escapedOrder}' and Set eq ${setValue} and OrderOrigin eq txgwi.OutboundOrderLines.OrderOrigin'${escapedOrderOrigin}'`,
  );
  params.set("$select", "*");

  const url = `${base}/${tenant}/LN/lnapi/odata/txgwi.OutboundOrderLines/OutboundOrderLines?${params.toString()}`;
  console.info("[ln-kitting-docs-order-set] requesting outbound order lines", { order, set: setValue, orderOrigin });

  const response = await fetchJson(url, accessToken, company);
  const payload = (await response.json().catch(() => null)) as any;
  if (!response.ok || !payload) {
    console.error("[ln-kitting-docs-order-set] outbound order lines upstream error", {
      status: response.status,
      order,
      set: setValue,
      orderOrigin,
      error: payload?.error?.message || "odata_error",
    });
    throw new Error(payload?.error?.message || "odata_error");
  }

  return Array.isArray(payload.value) ? payload.value : [];
}

async function fetchOutboundOrderLineBoms(
  base: string,
  tenant: string,
  accessToken: string,
  company: string,
  order: string,
  setValue: number,
  orderOrigin: string,
) {
  const escapedOrder = order.replace(/'/g, "''");
  const escapedOrderOrigin = orderOrigin.replace(/'/g, "''");
  const params = new URLSearchParams();
  params.set("$filter", "OutboundOrderLines/Order eq OutboundOrderLineBOMs/Order");
  params.set(
    "$expand",
    `OutboundOrderLines($select=*;$filter=Order eq '${escapedOrder}' and Set eq ${setValue} and OrderOrigin eq txgwi.OutboundOrderLines.OrderOrigin'${escapedOrderOrigin}'),OutboundOrderLineBOMs($select=*)`,
  );

  const url = `${base}/${tenant}/LN/lnapi/odata/txgwi.OutboundOrderLines/$crossjoin(OutboundOrderLines,OutboundOrderLineBOMs)?${params.toString()}`;
  console.info("[ln-kitting-docs-order-set] requesting outbound order line BOM crossjoin", {
    order,
    set: setValue,
    orderOrigin,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  const response = await fetchJson(url, accessToken, company);
  const payload = (await response.json().catch(() => null)) as any;
  if (!response.ok || !payload) {
    console.error("[ln-kitting-docs-order-set] outbound order line BOM crossjoin error", {
      status: response.status,
      order,
      set: setValue,
      orderOrigin,
      error: payload?.error?.message || "odata_error",
    });
    throw new Error(payload?.error?.message || "odata_error");
  }

  return Array.isArray(payload.value) ? payload.value : [];
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
      console.error("[ln-kitting-docs-order-set] invalid json body");
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const order = toText(body.order);
    const setValue = toNumber(body.set);
    const orderOrigin = toText(body.orderOrigin);

    if (!order) {
      console.warn("[ln-kitting-docs-order-set] missing order");
      return json({ ok: false, error: "missing_order" }, 200);
    }
    if (!Number.isInteger(setValue)) {
      console.warn("[ln-kitting-docs-order-set] invalid set", { set: body.set });
      return json({ ok: false, error: "invalid_set" }, 200);
    }
    if (!orderOrigin) {
      console.warn("[ln-kitting-docs-order-set] missing order origin");
      return json({ ok: false, error: "missing_order_origin" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-kitting-docs-order-set] missing env");
      return json({ ok: false, error: "env_missing" }, 200);
    }

    console.info("[ln-kitting-docs-order-set] start", { order, set: setValue, orderOrigin });

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = toText(body.company) || (await getCompanyFromParams(supabase));
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;

    try {
      const lineRows = await fetchOutboundOrderLines(base, cfg.ti, accessToken, company, order, setValue, orderOrigin);
      const bomRows = await fetchOutboundOrderLineBoms(base, cfg.ti, accessToken, company, order, setValue, orderOrigin);

      const lineMap = new Map<string, GroupedLine & { componentMap: Map<string, GroupedComponent> }>();
      const itemLookups = new Map<string, string>();

      for (const line of lineRows) {
        const key = lineKey(line);
        const rawItem = toRawText(line?.Item);
        const displayItem = toText(line?.Item);
        if (rawItem) {
          itemLookups.set(displayItem, rawItem);
        }

        lineMap.set(key, {
          orderOrigin: toText(line?.OrderOrigin),
          order: toText(line?.Order),
          set: toNumber(line?.Set),
          line: toNumber(line?.Line),
          sequence: toNumber(line?.Sequence),
          item: displayItem,
          itemRaw: rawItem,
          itemDescription: "",
          itemCreationDate: "",
          itemLastModificationDate: "",
          shippingWarehouse: toText(line?.ShippingWarehouse),
          orderUnit: toText(line?.OrderUnit),
          orderedQuantity: toNumber(line?.OrderedQuantity),
          originallyOrderedQuantity: toNumber(line?.OriginallyOrderedQuantity),
          lineStatus: toText(line?.LineStatus),
          rushOrder: toText(line?.RushOrder),
          salesOrderLineDetails: {
            shiptoBusinessPartner: "",
            shiptoAddress: "",
            listGroup: "",
            rushOrderLine: "",
            orderLineText: null,
            escalationComment: null,
            escalationLevel: "",
          },
          components: [],
          componentMap: new Map<string, GroupedComponent>(),
        });
      }

      for (const row of bomRows) {
        const line = row?.OutboundOrderLines;
        const bom = row?.OutboundOrderLineBOMs;
        if (!line || !bom) continue;

        const key = lineKey(line);
        const grouped = lineMap.get(key);
        if (!grouped) continue;
        if (lineKey(bom) !== key) continue;

        const bomKey = componentKey(bom);
        if (grouped.componentMap.has(bomKey)) continue;

        const rawComponent = toRawText(bom?.Component);
        const displayComponent = toText(bom?.Component);
        if (rawComponent) {
          itemLookups.set(displayComponent, rawComponent);
        }

        grouped.componentMap.set(bomKey, {
          orderOrigin: toText(bom?.OrderOrigin),
          order: toText(bom?.Order),
          line: toNumber(bom?.Line),
          sequence: toNumber(bom?.Sequence),
          set: toNumber(bom?.Set),
          bomLine: toNumber(bom?.BOMLine),
          component: displayComponent,
          componentRaw: rawComponent,
          warehouse: toText(bom?.Warehouse),
          quantity: toNumber(bom?.Quantity),
          orderedQuantity: toNumber(bom?.OrderedQuantity),
          originallyOrderedQuantity: toNumber(bom?.OriginallyOrderedQuantity),
          description: "",
          inventoryUnit: "",
          commentsInstructions: "",
          drawingOnFile: "",
        });
      }

      const itemDetailsEntries = await Promise.all(
        Array.from(itemLookups.entries()).map(async ([displayItem, rawItem]) => {
          const details = await fetchItemDetails(base, cfg.ti, accessToken, company, rawItem);
          return [displayItem, details] as const;
        }),
      );
      const itemDetailsMap = new Map<string, ItemDetails>(itemDetailsEntries);

      const salesOrderLineDetailsEntries = await Promise.all(
        Array.from(lineMap.entries()).map(async ([key, line]) => {
          const details = await fetchSalesOrderLineDetails(
            base,
            cfg.ti,
            accessToken,
            company,
            line.order,
            line.line,
            line.sequence,
          );
          return [key, details] as const;
        }),
      );
      const salesOrderLineDetailsMap = new Map<string, SalesOrderLineDetails>(salesOrderLineDetailsEntries);

      const listComponentDetailsEntries = await Promise.all(
        Array.from(lineMap.entries()).flatMap(([key, line]) => {
          const listGroup = salesOrderLineDetailsMap.get(key)?.listGroup || "";

          return Array.from(line.componentMap.values()).map(async (component) => {
            if (!listGroup || !line.itemRaw) {
              return [
                listComponentLookupKey(key, component.bomLine),
                { commentsInstructions: "", drawingOnFile: "" },
              ] as const;
            }

            const details = await fetchListComponentDetails(
              base,
              cfg.ti,
              accessToken,
              company,
              listGroup,
              line.itemRaw,
              component.bomLine,
            );

            return [listComponentLookupKey(key, component.bomLine), details] as const;
          });
        }),
      );
      const listComponentDetailsMap = new Map<string, ListComponentDetails>(listComponentDetailsEntries);

      const lines = Array.from(lineMap.values())
        .map(({ componentMap, ...line }) => ({
          ...line,
          itemDescription: itemDetailsMap.get(line.item)?.description || "",
          itemCreationDate: itemDetailsMap.get(line.item)?.creationDate || "",
          itemLastModificationDate: itemDetailsMap.get(line.item)?.lastModificationDate || "",
          salesOrderLineDetails:
            salesOrderLineDetailsMap.get(
              [line.orderOrigin, line.order, line.line, line.sequence, line.set].join("|"),
            ) || line.salesOrderLineDetails,
          components: Array.from(componentMap.values())
            .map((component) => ({
              ...component,
              description: itemDetailsMap.get(component.component)?.description || "",
              inventoryUnit: itemDetailsMap.get(component.component)?.inventoryUnit || "",
              commentsInstructions:
                listComponentDetailsMap.get(
                  listComponentLookupKey(
                    [line.orderOrigin, line.order, line.line, line.sequence, line.set].join("|"),
                    component.bomLine,
                  ),
                )?.commentsInstructions || "",
              drawingOnFile:
                listComponentDetailsMap.get(
                  listComponentLookupKey(
                    [line.orderOrigin, line.order, line.line, line.sequence, line.set].join("|"),
                    component.bomLine,
                  ),
                )?.drawingOnFile || "",
            }))
            .sort((a, b) => a.bomLine - b.bomLine),
        }))
        .sort((a, b) => a.line - b.line || a.sequence - b.sequence || a.set - b.set);

      console.info("[ln-kitting-docs-order-set] completed", {
        order,
        set: setValue,
        orderOrigin,
        mainLineCount: lineRows.length,
        bomRowCount: bomRows.length,
        lineCount: lines.length,
        itemLookups: itemLookups.size,
        listComponentLookups: listComponentDetailsEntries.length,
      });

      return json({ ok: true, count: lines.length, lines }, 200);
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      console.error("[ln-kitting-docs-order-set] upstream request failed", {
        isTimeout,
        error: error instanceof Error ? error.message : String(error),
      });
      return json({ ok: false, error: isTimeout ? "odata_timeout" : "odata_network_error", details: [] }, 200);
    }
  } catch (error) {
    console.error("[ln-kitting-docs-order-set] unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
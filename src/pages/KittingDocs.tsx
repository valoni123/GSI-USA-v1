import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showError, showSuccess } from "@/utils/toast";
import { clearStoredGsiPermissions } from "@/lib/gsi-permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  buildKittingOriginOptions,
  findKittingOriginOptionByConstantName,
  findKittingOriginOptionByEnglishLabel,
  getKittingOriginOption,
  type KittingOriginOption,
  type RawKittingOriginRow,
} from "@/lib/kitting-origins";

type KittingComponent = {
  orderOrigin: string;
  order: string;
  line: number;
  sequence: number;
  set: number;
  bomLine: number;
  component: string;
  warehouse: string;
  quantity: number;
  orderedQuantity: number;
  originallyOrderedQuantity: number;
  description: string;
  inventoryUnit: string;
};

type KittingLine = {
  orderOrigin: string;
  order: string;
  set: number;
  line: number;
  sequence: number;
  item: string;
  itemDescription: string;
  itemCreationDate: string;
  itemLastModificationDate: string;
  shippingWarehouse: string;
  orderUnit: string;
  orderedQuantity: number;
  originallyOrderedQuantity: number;
  lineStatus: string;
  components: KittingComponent[];
};

const FALLBACK_ORIGIN_ROW: RawKittingOriginRow = {
  constantName: "sales",
  descriptionLabel: "inh.oorg036",
};

const KittingDocs = () => {
  const navigate = useNavigate();
  const [lang] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem("app.lang") as LanguageKey | null;
    return saved || "en";
  });
  const trans = useMemo(() => t(lang), [lang]);

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  const [fullName, setFullName] = useState<string>("");
  useEffect(() => {
    const name = localStorage.getItem("gsi.full_name");
    if (name) setFullName(name);
  }, []);

  const [originRows, setOriginRows] = useState<RawKittingOriginRow[]>([FALLBACK_ORIGIN_ROW]);
  const [selectedOrigin, setSelectedOrigin] = useState("sales");
  const originOptions = useMemo(() => buildKittingOriginOptions(originRows, lang), [originRows, lang]);
  const selectedOriginOption = useMemo<KittingOriginOption>(() => {
    return (
      findKittingOriginOptionByConstantName(originOptions, selectedOrigin) ||
      getKittingOriginOption(FALLBACK_ORIGIN_ROW.constantName, FALLBACK_ORIGIN_ROW.descriptionLabel, lang)
    );
  }, [originOptions, selectedOrigin, lang]);

  useEffect(() => {
    let cancelled = false;

    const loadOriginOptions = async () => {
      const { data, error } = await supabase.functions.invoke("ln-kitting-order-origins", { body: {} });
      if (cancelled) return;

      if (error || !data || !data.ok) {
        showError(typeof data?.error === "string" ? data.error : trans.loadingDetails);
        return;
      }

      const rows = Array.isArray(data.rows) ? (data.rows as RawKittingOriginRow[]) : [];
      if (rows.length === 0) return;
      setOriginRows(rows);
    };

    void loadOriginOptions();
    return () => {
      cancelled = true;
    };
  }, [trans.loadingDetails]);

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [orderSet, setOrderSet] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");
  const [lines, setLines] = useState<KittingLine[]>([]);
  const [infoMessage, setInfoMessage] = useState("");

  const onConfirmSignOut = () => {
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
      clearStoredGsiPermissions();
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  const parseOrderSet = (value: string) => {
    const normalized = value.replace(/\r?\n/g, "").trim();
    const match = normalized.match(/^([^/]+)\s*\/\s*(\d+)$/);
    if (!match) return null;

    const order = match[1].trim();
    const set = Number(match[2]);
    if (!order || !Number.isInteger(set)) return null;
    return { order, set, key: `${order}/${set}` };
  };

  const formatItemNumber = (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return "-";
    return raw.replace(/^0{1,9}/, "") || raw;
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(Number.isFinite(value) ? value : 0);
  };

  const formatQuantityWithUnit = (value: number, unit: string) => {
    const formatted = formatNumber(value);
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const formatDate = (value: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };

  const clearLoadedState = () => {
    setLines([]);
    setInfoMessage("");
    setLoadedKey("");
  };

  const lookupOrderSet = async (rawValue?: string, originConstantName?: string) => {
    const nextValue = rawValue ?? orderSet;
    const parsed = parseOrderSet(nextValue);
    const originOption =
      findKittingOriginOptionByConstantName(originOptions, originConstantName || selectedOrigin) || selectedOriginOption;

    if (!nextValue.trim()) {
      clearLoadedState();
      return;
    }

    if (!parsed) {
      clearLoadedState();
      showError(trans.invalidOrderSet);
      return;
    }

    const requestKey = `${originOption.constantName}|${parsed.key}`;
    if (loading || requestKey === loadedKey) return;

    setLoading(true);
    setInfoMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("ln-kitting-docs-order-set", {
        body: {
          order: parsed.order,
          set: parsed.set,
          orderOrigin: originOption.englishLabel,
        },
      });

      setLoading(false);

      if (error || !data || !data.ok) {
        clearLoadedState();
        const message = (data && (data.error?.message || data.error)) || trans.loadingDetails;
        showError(typeof message === "string" ? message : trans.loadingDetails);
        return;
      }

      const nextLines = Array.isArray(data.lines) ? (data.lines as KittingLine[]) : [];
      setLines(nextLines);
      setLoadedKey(requestKey);
      setInfoMessage(nextLines.length === 0 ? trans.kittingNoOrderLines : "");
    } catch (error) {
      setLoading(false);
      clearLoadedState();
      showError(error instanceof Error ? error.message : String(error));
      return;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu")} />

          <div className="flex flex-col items-center flex-1 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/menu")}
              className="rounded-md bg-gray-200 px-4 py-1 font-bold text-lg tracking-wide text-center text-black hover:opacity-80"
            >
              {trans.appKittingDocs}
            </button>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-200">
              <User className="h-4 w-4 shrink-0" />
              <span className="line-clamp-1">{fullName || ""}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600 hover:bg-white/10"
            aria-label={trans.signOut}
            onClick={() => setSignOutOpen(true)}
          >
            <LogOut className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <Card className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md shadow-gray-300/70 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6">
              <div className="text-lg font-semibold text-gray-800">{trans.appKittingDocs}</div>

              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <div className="w-full md:w-[260px]">
                  <div className="relative pt-2">
                    <Select
                      value={selectedOrigin}
                      onValueChange={(value) => {
                        setSelectedOrigin(value);
                        clearLoadedState();
                        if (orderSet.trim()) {
                          void lookupOrderSet(orderSet, value);
                        }
                      }}
                    >
                      <SelectTrigger className="h-12 border-gray-300 text-base">
                        <span
                          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
                          style={{
                            backgroundColor: selectedOriginOption.style.bg,
                            color: selectedOriginOption.style.text,
                          }}
                        >
                          {selectedOriginOption.label}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {originOptions.map((option) => (
                          <SelectItem key={option.constantName} value={option.constantName}>
                            <span
                              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
                              style={{ backgroundColor: option.style.bg, color: option.style.text }}
                            >
                              {option.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="pointer-events-none absolute left-3 top-0 rounded-sm bg-white px-1 text-xs text-gray-700">
                      {trans.orderOriginLabel}
                    </label>
                  </div>
                </div>

                <div className="w-full max-w-xl space-y-2">
                  <div className="relative pt-2">
                    <Input
                      id="kittingOrderSet"
                      value={orderSet}
                      onChange={(e) => {
                        setOrderSet(e.target.value);
                        clearLoadedState();
                      }}
                      onBlur={() => {
                        if (orderSet.trim()) {
                          void lookupOrderSet(orderSet);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void lookupOrderSet(orderSet);
                        }
                      }}
                      placeholder={trans.scanOrderSetPlaceholder}
                      autoFocus
                      autoComplete="off"
                      className="h-12 border-gray-300 text-base sm:h-14 sm:text-lg"
                    />
                    <label
                      htmlFor="kittingOrderSet"
                      className="pointer-events-none absolute left-3 top-0 rounded-sm bg-white px-1 text-xs text-gray-700"
                    >
                      {trans.orderSetLabel}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {loading && (
            <Card className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md shadow-gray-300/70">
              <div className="text-sm font-medium text-gray-600">{trans.kittingLoading}</div>
            </Card>
          )}

          {!loading && infoMessage && (
            <Card className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md shadow-gray-300/70">
              <div className="text-sm font-medium text-gray-600">{infoMessage}</div>
            </Card>
          )}

          {!loading &&
            lines.map((line) => {
              const lineOriginOption =
                findKittingOriginOptionByEnglishLabel(originOptions, line.orderOrigin) || selectedOriginOption;

              return (
                <Card
                  key={`${line.orderOrigin}|${line.order}|${line.line}|${line.sequence}|${line.set}`}
                  className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md shadow-gray-300/70"
                >
                  <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base text-gray-600">{trans.orderLabel}:</span>
                        <span
                          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
                          style={{
                            backgroundColor: lineOriginOption.style.bg,
                            color: lineOriginOption.style.text,
                          }}
                        >
                          {lineOriginOption.label}
                        </span>
                        <span className="text-base font-semibold text-gray-900">{line.order}</span>
                        <span className="text-base font-semibold text-gray-900">{line.set}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base text-gray-600">{trans.lineLabel}:</span>
                        <span className="text-base font-semibold text-gray-900">{line.line}</span>
                        <span className="text-base text-gray-600">{trans.sequenceLabel}:</span>
                        <span className="text-base font-semibold text-gray-900">{line.sequence}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base text-gray-600">{trans.kittingMainItemLabel}:</span>
                        <div className="space-y-1">
                          <div className="text-base font-semibold text-gray-900">{formatItemNumber(line.item)}</div>
                          {line.itemDescription && <div className="text-xs text-gray-500">{line.itemDescription}</div>}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{trans.kittingInspectionLabel}</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">{formatDate(line.itemCreationDate)}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{trans.kittingLastRevisionLabel}</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">{formatDate(line.itemLastModificationDate)}</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 text-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">{trans.kittingBomLineLabel}</th>
                            <th className="px-4 py-3 text-left font-semibold">{trans.kittingComponentLabel}</th>
                            <th className="px-4 py-3 text-right font-semibold">{trans.kittingQtyPerMainItemLabel}</th>
                            <th className="px-4 py-3 text-right font-semibold">{trans.orderedLabel}</th>
                            <th className="px-4 py-3 text-right font-semibold">{trans.originallyOrderedLabel}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.components.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                                {trans.noComponentsLabel}
                              </td>
                            </tr>
                          ) : (
                            line.components.map((component) => (
                              <tr key={`${component.bomLine}-${component.component}`} className="border-t border-gray-200 align-top">
                                <td className="px-4 py-3 font-medium text-gray-900">{component.bomLine}</td>
                                <td className="px-4 py-3 text-gray-900">
                                  <div className="font-medium">{formatItemNumber(component.component)}</div>
                                  {component.description && (
                                    <div className="text-xs text-gray-500">{component.description}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                                  {formatQuantityWithUnit(component.quantity, component.inventoryUnit)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                                  {formatQuantityWithUnit(component.orderedQuantity, component.inventoryUnit)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                                  {formatQuantityWithUnit(component.originallyOrderedQuantity, component.inventoryUnit)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end">
                      <div className="inline-flex items-center gap-4 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-900">
                        <span>{trans.kittingTotalPartsLabel}</span>
                        <span>{line.components.length}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      </div>

      <SignOutConfirm
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title={trans.signOutTitle}
        question={trans.signOutQuestion}
        yesLabel={trans.yes}
        noLabel={trans.no}
        onConfirm={onConfirmSignOut}
      />
    </div>
  );
};

export default KittingDocs;
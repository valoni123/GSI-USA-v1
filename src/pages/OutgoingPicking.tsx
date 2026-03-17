import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import BackButton from "@/components/BackButton";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import ScreenSpinner from "@/components/ScreenSpinner";
import SignOutConfirm from "@/components/SignOutConfirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type LanguageKey, t } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

type PickingRow = {
  Run: string;
  OrderOrigin: string;
  Order: string;
  Set: string;
  Line: string;
  Sequence: string;
  Item: string;
  ItemDescription: string;
  Lot: string;
  Warehouse: string;
  Location: string;
  LocationTo: string;
  Unit: string;
  AdvisedQuantityInInventoryUnit: number;
  Picked: string;
};

const OutgoingPicking = () => {
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

  const [signOutOpen, setSignOutOpen] = useState(false);
  const onConfirmSignOut = () => {
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
      localStorage.removeItem("gsi.username");
      localStorage.removeItem("gsi.employee");
      localStorage.removeItem("gsi.login");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  const runRef = useRef<HTMLInputElement | null>(null);
  const [run, setRun] = useState("");
  const [lastFetchedRun, setLastFetchedRun] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRows, setPickerRows] = useState<PickingRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<PickingRow | null>(null);
  const [quantity, setQuantity] = useState("");
  const [locationFrom, setLocationFrom] = useState("");
  const [locationTo, setLocationTo] = useState("");
  const [lot, setLot] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  useEffect(() => {
    runRef.current?.focus();
  }, []);

  const clearSelection = () => {
    setSelectedRow(null);
    setPickerRows([]);
    setPickerOpen(false);
    setQuantity("");
    setLocationFrom("");
    setLocationTo("");
    setLot("");
    setInfoMessage("");
  };

  const sanitizeQuantity = (raw: string) => {
    const replaced = raw.replace(",", ".");
    let value = replaced.replace(/[^0-9.]/g, "");
    const firstDot = value.indexOf(".");
    if (firstDot !== -1) {
      value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, "");
    }
    if (value.startsWith(".")) value = `0${value}`;
    return value;
  };

  const applyRow = (row: PickingRow) => {
    setSelectedRow(row);
    setQuantity(String(row.AdvisedQuantityInInventoryUnit ?? ""));
    setLocationFrom(row.Location || "");
    setLocationTo(row.LocationTo || "");
    setLot(row.Lot || "");
    setPickerOpen(false);
    setInfoMessage("");
  };

  const lookupRun = async (runValue?: string) => {
    const nextRun = (runValue ?? run).trim();
    if (!nextRun) {
      setRun("");
      setLastFetchedRun(null);
      clearSelection();
      return;
    }
    if (lookupLoading || lastFetchedRun === nextRun) return;

    setLookupLoading(true);
    setInfoMessage("");

    try {
      const result = await Promise.race([
        supabase.functions.invoke("ln-outbound-advices-by-run", {
          body: { run: nextRun, language: locale, company: "1100" },
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("timeout")), 16000);
        }),
      ]);

      const { data, error } = result as { data: any; error: any };
      setLookupLoading(false);
      setLastFetchedRun(nextRun);

      if (error || !data || !data.ok) {
        clearSelection();
        const message = (data && (data.error?.message || data.error)) || trans.loadingDetails;
        showError(typeof message === "string" ? message : trans.loadingDetails);
        return;
      }

      const rows = Array.isArray(data.rows) ? (data.rows as PickingRow[]) : [];
      if (rows.length === 0) {
        clearSelection();
        setInfoMessage(trans.pickingNoAdvices);
        return;
      }

      if ((data.count ?? rows.length) > 1) {
        setPickerRows(rows);
        setPickerOpen(true);
        setSelectedRow(null);
        setQuantity("");
        setLocationFrom("");
        setLocationTo("");
        setLot("");
        return;
      }

      applyRow(rows[0]);
    } catch (error) {
      setLookupLoading(false);
      clearSelection();
      showError(error instanceof Error && error.message === "timeout" ? trans.pickingTimeout : String(error));
    }
  };

  const orderOriginBadgeClass = (value: string) => {
    if (!value) return "bg-gray-200 text-gray-800";
    const normalized = value.trim().toLowerCase();
    if (normalized.includes("sales")) return "bg-[#55a3f3] text-black";
    if (normalized.includes("transfer")) return "bg-[#fcc888] text-black";
    if (normalized.includes("production")) return "bg-[#78d8a3] text-black";
    return "bg-[#a876eb] text-white";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu/outgoing")} />

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">{trans.outgoingPicking}</div>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-200">
              <User className="h-4 w-4" />
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

      <div className="mx-auto max-w-md px-4 py-6 pb-10">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          <FloatingLabelInput
            id="pickingRun"
            label={trans.runLabel}
            ref={runRef}
            value={run}
            onChange={(e) => {
              const value = e.target.value;
              setRun(value);
              if (value.trim() !== (lastFetchedRun || "")) {
                clearSelection();
              }
              if (!value.trim()) {
                setLastFetchedRun(null);
              }
            }}
            onBlur={() => {
              if (run.trim()) {
                void lookupRun(run);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && run.trim()) {
                e.preventDefault();
                void lookupRun(run);
              }
            }}
            onFocus={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClear={() => {
              setRun("");
              setLastFetchedRun(null);
              clearSelection();
              runRef.current?.focus();
            }}
            autoFocus
          />

          {selectedRow && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center rounded px-3 py-1 text-xs font-semibold ${orderOriginBadgeClass(selectedRow.OrderOrigin)}`}>
                  {trans.orderOriginLabel}: {selectedRow.OrderOrigin || "-"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FloatingLabelInput id="pickingOrder" label={trans.orderLabel} value={selectedRow.Order || ""} disabled />
                <FloatingLabelInput id="pickingSet" label={trans.setLabel} value={selectedRow.Set || ""} disabled />
                <FloatingLabelInput id="pickingLine" label={trans.lineLabel} value={selectedRow.Line || ""} disabled />
                <FloatingLabelInput id="pickingSequence" label={trans.sequenceLabel} value={selectedRow.Sequence || ""} disabled />
                <FloatingLabelInput id="pickingItem" label={trans.itemLabel} value={selectedRow.Item || ""} disabled />
                <FloatingLabelInput id="pickingWarehouse" label={trans.warehouseLabel} value={selectedRow.Warehouse || ""} disabled />
              </div>

              {selectedRow.ItemDescription ? (
                <FloatingLabelInput id="pickingDescription" label={trans.itemDescriptionLabel} value={selectedRow.ItemDescription} disabled />
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <FloatingLabelInput
                  id="pickingQuantity"
                  label={trans.advisedQuantityLabel}
                  value={quantity}
                  onChange={(e) => setQuantity(sanitizeQuantity(e.target.value))}
                  inputMode="decimal"
                />
                <FloatingLabelInput id="pickingUnit" label={trans.unitLabel} value={selectedRow.Unit || ""} disabled />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FloatingLabelInput id="pickingLocationFrom" label={trans.locationFromLabel} value={locationFrom} onChange={(e) => setLocationFrom(e.target.value)} />
                <FloatingLabelInput id="pickingLocationTo" label={trans.locationToLabel} value={locationTo} onChange={(e) => setLocationTo(e.target.value)} />
              </div>

              {(selectedRow.Lot || lot) ? (
                <FloatingLabelInput id="pickingLot" label={trans.lotLabel} value={lot} onChange={(e) => setLot(e.target.value)} />
              ) : null}

              <FloatingLabelInput id="pickingPicked" label={trans.pickedLabel} value={selectedRow.Picked || ""} disabled />
            </div>
          )}

          {!selectedRow && !lookupLoading && infoMessage ? (
            <div className="text-sm text-muted-foreground">{infoMessage}</div>
          ) : null}
        </Card>
      </div>

      {lookupLoading && <ScreenSpinner message={trans.loadingDetails} />}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="border-b bg-black px-4 py-3 text-white">
            <DialogTitle>{trans.pickingSelectAdviceTitle}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto p-3 space-y-3">
            {pickerRows.map((row, index) => (
              <button
                key={`${row.Order}-${row.Set}-${row.Line}-${row.Sequence}-${index}`}
                type="button"
                className="w-full rounded-md border bg-gray-50 px-3 py-2.5 text-left hover:bg-gray-100"
                onClick={() => applyRow(row)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`inline-flex shrink-0 items-center rounded px-2.5 py-1 text-xs font-semibold ${orderOriginBadgeClass(row.OrderOrigin)}`}>
                      {row.OrderOrigin || "-"}
                    </span>
                    <div className="min-w-0 text-sm font-medium text-gray-900 break-all">
                      {row.Order || "-"}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-gray-500">{trans.runLabel}: {row.Run || run.trim()}</div>
                </div>

                {row.ItemDescription ? (
                  <div className="mt-2 text-xs text-gray-600 break-all">
                    {row.ItemDescription}
                  </div>
                ) : null}

                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="min-w-0">
                    <span className="text-gray-500">{trans.itemLabel}:</span>{" "}
                    <span className="text-gray-900 break-all">{row.Item || "-"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500">{trans.lotLabel}:</span>{" "}
                    <span className="text-gray-900 break-all">{row.Lot || "-"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500">{trans.locationFromLabel}:</span>{" "}
                    <span className="text-gray-900 break-all">{row.Location || "-"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500">{trans.locationToLabel}:</span>{" "}
                    <span className="text-gray-900 break-all">{row.LocationTo || "-"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500">{trans.warehouseLabel}:</span>{" "}
                    <span className="text-gray-900 break-all">{row.Warehouse || "-"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500">{trans.advisedQuantityLabel}:</span>{" "}
                    <span className="text-gray-900 break-all">{row.AdvisedQuantityInInventoryUnit} {row.Unit || ""}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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

export default OutgoingPicking;
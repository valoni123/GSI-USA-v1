import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eraser, LogOut, User } from "lucide-react";
import BackButton from "@/components/BackButton";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type LanguageKey, t } from "@/lib/i18n";
import { getStoredGsiPermissions, hasPermission } from "@/lib/gsi-permissions";
import { showError, showLoading, showSuccess, dismissToast } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { getStoredGsiUsername } from "@/lib/gsi-user";

type TransportLineLoadState = {
  prefillValue?: string;
  vehicleId?: string;
  transportId?: string;
  item?: string;
  handlingUnit?: string;
  locationFrom?: string;
  warehouse?: string;
  orderedQuantity?: number | string | null;
  orderUnit?: string | null;
};

const displayValue = (value: string) => {
  const trimmed = (value || "").trim();
  return trimmed || "-";
};

const displayQuantity = (quantity?: number | string | null, unit?: string | null) => {
  const quantityText = quantity == null ? "" : String(quantity).trim();
  const unitText = (unit || "").trim();
  if (!quantityText && !unitText) return "-";
  if (!quantityText) return unitText;
  return unitText ? `${quantityText} ${unitText}` : quantityText;
};

const TransportLineLoad = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as TransportLineLoadState | null) || null;

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
  const permissions = useMemo(() => getStoredGsiPermissions(), []);
  const canAdjust = hasPermission(permissions, "corr");

  const [fullName, setFullName] = useState("");
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [transportValue, setTransportValue] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [locationFrom, setLocationFrom] = useState("");
  const [locationFromScan, setLocationFromScan] = useState("");
  const [transportId, setTransportId] = useState("");
  const [item, setItem] = useState("");
  const [handlingUnit, setHandlingUnit] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [orderedQuantity, setOrderedQuantity] = useState<number | string | null>(null);
  const [orderUnit, setOrderUnit] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const name = localStorage.getItem("gsi.full_name");
    if (name) setFullName(name);
  }, []);

  useEffect(() => {
    const storedStateRaw = sessionStorage.getItem("transport.line.load.state");
    const storedState = storedStateRaw ? (JSON.parse(storedStateRaw) as TransportLineLoadState) : null;
    const storedPrefill = (sessionStorage.getItem("transport.line.load.prefill") || "").trim();
    const storedVehicle = (sessionStorage.getItem("transport.line.load.vehicle") || "").trim();

    const nextPrefill = (routeState?.prefillValue || storedState?.prefillValue || storedPrefill).trim();
    const nextVehicleId = (
      routeState?.vehicleId ||
      storedState?.vehicleId ||
      localStorage.getItem("transports.vehicle.id") ||
      localStorage.getItem("vehicle.id") ||
      storedVehicle ||
      ""
    ).trim();

    setTransportValue(nextPrefill);
    setVehicleId(nextVehicleId);
    setLocationFrom((routeState?.locationFrom || storedState?.locationFrom || "").trim());
    setTransportId((routeState?.transportId || storedState?.transportId || "").trim());
    setItem((routeState?.item || storedState?.item || "").trim());
    setHandlingUnit((routeState?.handlingUnit || storedState?.handlingUnit || "").trim());
    setWarehouse((routeState?.warehouse || storedState?.warehouse || "").trim());
    setOrderedQuantity(routeState?.orderedQuantity ?? storedState?.orderedQuantity ?? null);
    setOrderUnit((routeState?.orderUnit || storedState?.orderUnit || "").trim());

    sessionStorage.removeItem("transport.line.load.prefill");
    sessionStorage.removeItem("transport.line.load.vehicle");
  }, [routeState]);

  const expectedScanValue = handlingUnit.trim() ? transportValue.trim() : locationFrom.trim();
  const scanMatches = locationFromScan.trim() === expectedScanValue && expectedScanValue.length > 0;

  const handleAdjust = () => {
    if (!canAdjust) return;
    const value = transportValue.trim();
    if (!value) return;

    navigate("/menu/info-stock/correction", {
      state: {
        initialHandlingUnit: value,
        returnTo: {
          path: "/menu/transports/load",
          state: {
            prefillValue: value,
            vehicleId,
            transportId,
            item,
            handlingUnit,
            locationFrom,
            warehouse,
            orderedQuantity,
            orderUnit,
          },
        },
      },
    });
  };

  const mismatchMessage = handlingUnit.trim() ? "Handling Unit not matching" : "Location not matching";

  const handleScanMismatch = () => {
    const scannedValue = locationFromScan.trim();
    if (!scannedValue || scanMatches) return;
    showError(mismatchMessage);
  };

  const handleLoadClick = async () => {
    if (!scanMatches || processing) {
      if (!scanMatches) {
        showError(mismatchMessage);
      }
      return;
    }

    const employeeCode = getStoredGsiUsername();
    const selectedVehicleId = vehicleId.trim();
    const sourceWarehouse = warehouse.trim();
    const sourceLocation = locationFrom.trim();
    const currentTransportId = transportId.trim();
    const currentHandlingUnit = handlingUnit.trim();
    const currentItem = item.trim();

    if (!employeeCode || !selectedVehicleId || !sourceWarehouse || !sourceLocation || !currentTransportId) {
      showError("Missing transport data.");
      return;
    }

    const movePayload: Record<string, unknown> = {
      transferId: "",
      fromWarehouse: sourceWarehouse,
      fromLocation: sourceLocation,
      toWarehouse: sourceWarehouse,
      toLocation: selectedVehicleId,
      scan1: currentTransportId,
      loginCode: employeeCode,
      employee: employeeCode,
      language: locale,
    };

    if (currentHandlingUnit) {
      movePayload.handlingUnit = currentHandlingUnit;
    } else {
      const quantityNumber =
        typeof orderedQuantity === "number"
          ? orderedQuantity
          : Number(String(orderedQuantity ?? "").trim() || "0");

      if (!currentItem || Number.isNaN(quantityNumber) || quantityNumber <= 0) {
        showError("Missing item quantity.");
        return;
      }

      movePayload.item = `${" ".repeat(9)}${currentItem}`;
      movePayload.quantity = quantityNumber;
    }

    setProcessing(true);

    const tid = showLoading(trans.executingMovement);
    const { data, error } = await supabase.functions.invoke("ln-move-to-location", {
      body: movePayload,
    });
    dismissToast(tid as unknown as string);

    if (error || !data || !data.ok) {
      const err = (data && data.error) || error;
      const top = err?.message || "Unbekannter Fehler";
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d?.message).filter(Boolean) : [];
      const message = details.length > 0 ? `${top}\nDETAILS:\n${details.join("\n")}` : top;
      showError(message);
      setProcessing(false);
      return;
    }

    setProcessing(false);
    showSuccess(trans.loadedSuccessfully);
    navigate("/menu/transports/list");
  };

  const onConfirmSignOut = () => {
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
      localStorage.removeItem("gsi.username");
      localStorage.removeItem("gsi.employee");
      localStorage.removeItem("gsi.login");
      localStorage.removeItem("vehicle.id");
      localStorage.removeItem("transports.vehicle.id");
      localStorage.removeItem("transport.count");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu/transports/list")} />

          <div className="flex flex-col items-center flex-1">
            <button
              type="button"
              onClick={() => navigate("/menu/transports/list")}
              className="rounded-md bg-gray-200 px-4 py-1 font-bold text-lg tracking-wide text-black hover:opacity-80"
            >
              Transport-Load
            </button>
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

      <div className="mx-auto max-w-md px-4 py-6">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <FloatingLabelInput
                id="transportLineLoadValue"
                label="Handling Unit / Item"
                value={transportValue}
                onChange={(e) => setTransportValue(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className={canAdjust
                ? "mt-1 h-12 w-12 shrink-0 border-orange-300 bg-orange-100 text-orange-700 hover:bg-orange-200 hover:text-orange-800 disabled:opacity-50"
                : "mt-1 h-12 w-12 shrink-0 border-gray-300 bg-gray-200 text-gray-500 hover:bg-gray-200 hover:text-gray-500 disabled:opacity-100"}
              disabled={!canAdjust || !transportValue.trim()}
              onClick={handleAdjust}
              aria-label={trans.adjustAction}
              title={trans.adjustAction}
            >
              <Eraser className="h-5 w-5" />
            </Button>
          </div>

          <FloatingLabelInput
            id="transportLineLoadVehicle"
            label={trans.loadVehicleId}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          />

          <FloatingLabelInput
            id="transportLineLoadLocationFromValue"
            label="Location From"
            value={locationFrom}
            readOnly
          />

          <FloatingLabelInput
            id="transportLineLoadLocationFromScan"
            label={handlingUnit.trim() ? "Handling Unit" : "Location From"}
            value={locationFromScan}
            onChange={(e) => setLocationFromScan(e.target.value)}
            onBlur={handleScanMismatch}
            autoFocus
            className="border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
          />

          <div className="space-y-2 rounded-md border border-gray-200 px-3 py-3 text-sm">
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2">
              <span className="font-semibold text-gray-700">Transport-ID:</span>
              <span className="break-all text-gray-900">{displayValue(transportId)}</span>

              <span className="font-semibold text-gray-700">Item:</span>
              <span className="break-all text-gray-900">{displayValue(item)}</span>

              <span className="font-semibold text-gray-700">{trans.warehouseLabel}:</span>
              <span className="break-all text-gray-900">{displayValue(warehouse)}</span>

              <span className="font-semibold text-gray-700">{trans.quantityLabel}:</span>
              <span className="break-all text-gray-900">{displayQuantity(orderedQuantity, orderUnit)}</span>

              {handlingUnit.trim() ? (
                <>
                  <span className="font-semibold text-gray-700">Handling Unit:</span>
                  <span className="break-all text-gray-900">{displayValue(handlingUnit)}</span>
                </>
              ) : null}
            </div>
          </div>

          <Button
            type="button"
            className="w-full bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
            disabled={!scanMatches || processing}
            onClick={handleLoadClick}
          >
            LOAD
          </Button>
        </Card>
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

export default TransportLineLoad;
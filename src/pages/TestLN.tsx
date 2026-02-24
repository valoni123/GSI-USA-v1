"use client";

import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { Input } from "@/components/ui/input";
import ScreenSpinner from "@/components/ScreenSpinner";
import { showError, showSuccess } from "@/utils/toast";
import { type LanguageKey, t } from "@/lib/i18n";

const TestLN: React.FC = () => {
  const [lang] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem("app.lang") as LanguageKey | null;
    return saved || "en";
  });
  const trans = useMemo(() => t(lang), [lang]);

  const [baseUrl, setBaseUrl] = useState<string>(() => localStorage.getItem("ln.odataBase") || "");
  const [company, setCompany] = useState<string>(() => localStorage.getItem("ln.company") || "1100");
  const [language, setLanguage] = useState<string>(() => localStorage.getItem("ln.language") || "en-US");
  const [code, setCode] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>(() => (localStorage.getItem("vehicle.id") || "").trim());
  const [screenLoading, setScreenLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<string>("");

  const lnToken = (localStorage.getItem("ln.token") || "").trim();

  const ensureSettings = (): boolean => {
    const base = (baseUrl || "").trim();
    if (!lnToken) {
      showError("Missing ln.token in localStorage (log in first).");
      return false;
    }
    if (!base) {
      showError("Please enter the LN OData base URL (e.g., https://{IU}/{TI}/LN/lnapi/odata).");
      return false;
    }
    try {
      localStorage.setItem("ln.odataBase", base);
      localStorage.setItem("ln.company", (company || "").trim());
      localStorage.setItem("ln.language", (language || "").trim());
    } catch {}
    return true;
  };

  const callLN = async (fullUrl: string) => {
    setScreenLoading(true);
    setResponse("");
    try {
      const res = await fetch(fullUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": (company || "").trim(),
          Authorization: `Bearer ${lnToken}`,
        },
      });
      const text = await res.text();
      setResponse(text);
      if (!res.ok) {
        showError(`HTTP ${res.status}`);
      } else {
        showSuccess("OK");
      }
    } catch (e: any) {
      showError(e?.message || "Network error");
    } finally {
      setScreenLoading(false);
    }
  };

  const buildOrderLookupUrl = (): string => {
    const c = (code || "").trim();
    const esc = c.replace(/'/g, "''");
    const selectCols = "TransportID,RunNumber,Item,HandlingUnit,Warehouse,LocationFrom,LocationTo,OrderedQuantity";
    const filter = `(HandlingUnit eq '${esc}' or Item eq '${esc}' or endswith(HandlingUnit,'${esc}') or endswith(Item,'${esc}'))`;
    const path = `/txgwi.TransportOrders/TransportOrders?$filter=${encodeURIComponent(filter)}&$select=${selectCols}&$top=10`;
    const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}${path}`;
  };

  const buildLoadedCheckUrl = (): string => {
    const hu = (code || "").trim();
    const vid = (vehicleId || "").trim();
    const escHU = hu.replace(/'/g, "''");
    const escVID = vid.replace(/'/g, "''");
    const path = `/txgwi.TransportOrders/TransportOrders?$filter=${encodeURIComponent(
      `HandlingUnit eq '${escHU}' and VehicleID eq '${escVID}'`
    )}&$select=TransportID&$count=true`;
    const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}${path}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-6">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          <div className="text-lg font-bold">Test LN OData (Direct)</div>

          <FloatingLabelInput
            id="lnBase"
            label="LN OData Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://{IU}/{TI}/LN/lnapi/odata"
          />
          <div className="grid grid-cols-2 gap-2">
            <FloatingLabelInput
              id="lnCompany"
              label="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <FloatingLabelInput
              id="lnLanguage"
              label="Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </div>

          <FloatingLabelInput
            id="code"
            label={trans.itemOrHandlingUnit}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <FloatingLabelInput
            id="vehicleId"
            label={trans.loadVehicleId}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-10 bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (!ensureSettings()) return;
                const url = buildOrderLookupUrl();
                await callLN(url);
              }}
            >
              Order lookup
            </Button>
            <Button
              className="h-10 bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (!ensureSettings()) return;
                const url = buildLoadedCheckUrl();
                await callLN(url);
              }}
              disabled={!vehicleId.trim()}
            >
              Loaded check
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Response</div>
            <Input
              asChild={false}
              value={response}
              onChange={() => {}}
              readOnly
              className="h-56 whitespace-pre-wrap font-mono text-xs"
            />
          </div>
        </Card>
      </div>

      {screenLoading && <ScreenSpinner message={trans.pleaseWait} />}
    </div>
  );
};

export default TestLN;
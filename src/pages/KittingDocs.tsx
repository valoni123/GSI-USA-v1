import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, FileImage, Loader2, LogOut, Printer, User } from "lucide-react";
import jsPDF from "jspdf";
import { PDFDocument } from "pdf-lib";
import BackButton from "@/components/BackButton";
import ItemDrawingDialog from "@/components/ItemDrawingDialog";
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

type SalesOrderLineDetails = {
  shiptoBusinessPartner: string;
  shiptoAddress: string;
  listGroup: string;
  rushOrderLine: string;
  orderLineText: string | null;
  escalationComment: string | null;
  escalationLevel: string;
};

type KittingLine = {
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
  salesOrderLineDetails?: SalesOrderLineDetails;
  components: KittingComponent[];
};

type DrawingMeta = {
  found: boolean;
  filename: string;
};

type DrawingPdfPayload = {
  bytes: Uint8Array;
  filename: string;
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
  const [scanLoadingVisible, setScanLoadingVisible] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");
  const [lines, setLines] = useState<KittingLine[]>([]);
  const [infoMessage, setInfoMessage] = useState("");
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [drawingUrl, setDrawingUrl] = useState("");
  const [drawingTitle, setDrawingTitle] = useState("");
  const [drawingFilename, setDrawingFilename] = useState("");
  const [drawingLoadingKey, setDrawingLoadingKey] = useState("");
  const [combinedDrawingLoadingKey, setCombinedDrawingLoadingKey] = useState("");
  const [lineDrawingLoadingKey, setLineDrawingLoadingKey] = useState("");
  const [lineComponentListLoadingKey, setLineComponentListLoadingKey] = useState("");
  const [drawingMetaByItem, setDrawingMetaByItem] = useState<Record<string, DrawingMeta>>({});
  const [drawingMetaLoadingByItem, setDrawingMetaLoadingByItem] = useState<Record<string, boolean>>({});
  const [drawingItemRaws, setDrawingItemRaws] = useState<string[]>([]);
  const [printedItems, setPrintedItems] = useState<Record<string, boolean>>({});
  const scanLoadingTimeoutRef = useRef<number | null>(null);

  const startScanLoading = () => {
    setScanLoadingVisible(true);
    if (scanLoadingTimeoutRef.current !== null) {
      window.clearTimeout(scanLoadingTimeoutRef.current);
    }
    scanLoadingTimeoutRef.current = window.setTimeout(() => {
      setScanLoadingVisible(false);
      scanLoadingTimeoutRef.current = null;
    }, 5000);
  };

  const stopScanLoading = () => {
    if (scanLoadingTimeoutRef.current !== null) {
      window.clearTimeout(scanLoadingTimeoutRef.current);
      scanLoadingTimeoutRef.current = null;
    }
    setScanLoadingVisible(false);
  };

  useEffect(() => {
    return () => {
      if (scanLoadingTimeoutRef.current !== null) {
        window.clearTimeout(scanLoadingTimeoutRef.current);
      }
    };
  }, []);

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
    const safeValue = Number.isFinite(value) ? value : 0;
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(safeValue);

    return Number.isInteger(safeValue) ? formatted.replace(/,/g, ".") : formatted;
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

  const getLineKey = (line: KittingLine) => `${line.orderOrigin}|${line.order}|${line.line}|${line.sequence}|${line.set}`;

  const base64ToUint8Array = (value: string) => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  };

  const openPdfPreview = (pdfBytes: Uint8Array, title: string, filename: string, rawItems: string[]) => {
    if (drawingUrl.startsWith("blob:")) {
      URL.revokeObjectURL(drawingUrl);
    }

    const blobUrl = URL.createObjectURL(
      new Blob([pdfBytes], {
        type: "application/pdf",
      }),
    );

    setDrawingTitle(title);
    setDrawingFilename(filename);
    setDrawingUrl(blobUrl);
    setDrawingOpen(true);
    setDrawingItemRaws(Array.from(new Set(rawItems.filter(Boolean))));
  };

  const clearLoadedState = () => {
    setLines([]);
    setInfoMessage("");
    setLoadedKey("");
    setDrawingMetaByItem({});
    setDrawingMetaLoadingByItem({});
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
    startScanLoading();
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
      stopScanLoading();

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
      stopScanLoading();
      clearLoadedState();
      showError(error instanceof Error ? error.message : String(error));
      return;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const uniqueItems = Array.from(
      new Set(
        lines.flatMap((line) => [
          line.itemRaw,
          ...line.components.map((component) => component.componentRaw),
        ]).filter(Boolean),
      ),
    );
    const itemsToFetch = uniqueItems.filter((item) => !drawingMetaByItem[item] && !drawingMetaLoadingByItem[item]);
    if (itemsToFetch.length === 0) return;

    setDrawingMetaLoadingByItem((current) => ({
      ...current,
      ...Object.fromEntries(itemsToFetch.map((item) => [item, true])),
    }));

    const loadDrawingMeta = async () => {
      const results = await Promise.all(
        itemsToFetch.map(async (item) => {
          const { data, error } = await supabase.functions.invoke("ln-idm-item-drawing", {
            body: { item, includePdf: false },
          });

          return [
            item,
            {
              found: !error && !!data?.ok && !!data?.found,
              filename: !error && data?.found && typeof data?.filename === "string" ? data.filename : "",
            },
          ] as const;
        }),
      );

      if (cancelled) return;

      setDrawingMetaByItem((current) => ({
        ...current,
        ...Object.fromEntries(results),
      }));
      setDrawingMetaLoadingByItem((current) => ({
        ...current,
        ...Object.fromEntries(itemsToFetch.map((item) => [item, false])),
      }));
    };

    void loadDrawingMeta();

    return () => {
      cancelled = true;
    };
  }, [lines, drawingMetaByItem]);

  const getDrawingFilename = (rawItem: string) => drawingMetaByItem[rawItem]?.filename || "";
  const isDrawingFilenameLoading = (rawItem: string) => !!drawingMetaLoadingByItem[rawItem];
  const isDrawingAvailable = (rawItem: string) => !!drawingMetaByItem[rawItem]?.found;
  const isDrawingButtonDisabled = (rawItem: string) => !rawItem || !!drawingMetaLoadingByItem[rawItem] || !isDrawingAvailable(rawItem);

  const getLineDocumentEntries = (line: KittingLine) => {
    const entries = [
      { rawItem: line.itemRaw, displayItem: line.item },
      ...line.components.map((component) => ({
        rawItem: component.componentRaw,
        displayItem: component.component,
      })),
    ];

    return entries.filter((entry) => entry.rawItem && isDrawingAvailable(entry.rawItem));
  };

  const getLoadedDocumentEntries = () => {
    const entries = lines.flatMap((line) => getLineDocumentEntries(line));
    const seen = new Set<string>();

    return entries.filter((entry) => {
      if (seen.has(entry.rawItem)) return false;
      seen.add(entry.rawItem);
      return true;
    });
  };

  const isLoadedDocumentsMetaLoading = () => {
    const itemRaws = Array.from(
      new Set(
        lines.flatMap((line) => [line.itemRaw, ...line.components.map((component) => component.componentRaw)]).filter(Boolean),
      ),
    );

    return itemRaws.some((rawItem) => isDrawingFilenameLoading(rawItem));
  };

  const fetchDrawingPdf = async (rawItem: string): Promise<DrawingPdfPayload> => {
    const { data, error } = await supabase.functions.invoke("ln-idm-item-drawing", {
      body: { item: rawItem },
    });

    if (error || !data || !data.ok || !data.found || !data.pdfBase64) {
      throw new Error("drawing_load_failed");
    }

    return {
      bytes: base64ToUint8Array(String(data.pdfBase64)),
      filename: typeof data.filename === "string" ? data.filename : "",
    };
  };

  const openMergedDrawingsPreview = async (
    documentEntries: Array<{ rawItem: string; displayItem: string }>,
    title: string,
    filename: string,
  ) => {
    const drawings = await Promise.all(documentEntries.map((entry) => fetchDrawingPdf(entry.rawItem)));
    const mergedPdf = await PDFDocument.create();

    for (const drawing of drawings) {
      const sourcePdf = await PDFDocument.load(drawing.bytes);
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    openPdfPreview(
      mergedBytes,
      title,
      filename,
      documentEntries.map((entry) => entry.rawItem),
    );
  };

  const buildLineComponentsPdf = (line: KittingLine) => {
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const left = 40;
    const right = pageWidth - 40;
    let y = 42;

    const addText = (text: string, x: number, nextY = 16) => {
      pdf.text(text, x, y);
      y += nextY;
    };

    const ensureSpace = (needed = 20) => {
      if (y + needed <= pageHeight - 40) return;
      pdf.addPage();
      y = 42;
    };

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    addText(trans.kittingPrintListComponentsLabel, left, 22);

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    addText(`${trans.orderLabel}: ${line.order}`, left);
    addText(`${trans.setLabel}: ${line.set}`, left);
    addText(`${trans.lineLabel}: ${line.line}    ${trans.sequenceLabel}: ${line.sequence}`, left);
    addText(`${trans.kittingMainItemLabel}: ${formatItemNumber(line.item)} ${line.itemDescription || ""}`.trim(), left, 22);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(trans.kittingBomLineLabel, left, y);
    pdf.text(trans.kittingComponentLabel, left + 70, y);
    pdf.text(trans.quantityLabel, right - 210, y, { align: "right" });
    pdf.text(trans.kittingDrawingFileNameLabel, right, y, { align: "right" });
    y += 10;
    pdf.setLineWidth(0.8);
    pdf.line(left, y, right, y);
    y += 16;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    line.components.forEach((component) => {
      ensureSpace(34);
      pdf.text(String(component.bomLine), left, y);
      pdf.text(formatItemNumber(component.component), left + 70, y);
      if (component.description) {
        pdf.setFontSize(8);
        pdf.text(component.description, left + 70, y + 11);
        pdf.setFontSize(9);
      }
      pdf.text(formatQuantityWithUnit(component.quantity, component.inventoryUnit), right - 210, y, { align: "right" });
      pdf.text(getDrawingFilename(component.componentRaw), right, y, { align: "right" });
      y += 26;
    });

    return new Uint8Array(pdf.output("arraybuffer"));
  };

  useEffect(() => {
    return () => {
      if (drawingUrl.startsWith("blob:")) {
        URL.revokeObjectURL(drawingUrl);
      }
    };
  }, [drawingUrl]);

  const openDrawing = async (rawItem: string, displayItem: string) => {
    const requestKey = `${displayItem}|${rawItem}`;
    if (!rawItem || drawingLoadingKey === requestKey || isDrawingButtonDisabled(rawItem)) return;

    setDrawingLoadingKey(requestKey);
    startScanLoading();

    try {
      const drawing = await fetchDrawingPdf(rawItem);
      setDrawingLoadingKey("");
      stopScanLoading();
      openPdfPreview(
        drawing.bytes,
        `${trans.kittingDrawingTitle}: ${formatItemNumber(displayItem)}`,
        drawing.filename,
        [rawItem],
      );
    } catch {
      setDrawingLoadingKey("");
      stopScanLoading();
      showError(trans.kittingDrawingLoadFailed);
    }
  };

  const openAllLoadedDrawings = async () => {
    if (combinedDrawingLoadingKey === "all" || isLoadedDocumentsMetaLoading()) return;

    const documentEntries = getLoadedDocumentEntries();
    if (documentEntries.length === 0) {
      showError(trans.kittingNoDocumentsAvailableLabel);
      return;
    }

    const firstLine = lines[0];
    setCombinedDrawingLoadingKey("all");
    startScanLoading();

    try {
      await openMergedDrawingsPreview(
        documentEntries,
        `${trans.kittingPrintAllDocumentsLabel}: ${firstLine?.order || ""}/${firstLine?.set || ""}`,
        `kitting-${firstLine?.order || "order"}-${firstLine?.set || "set"}.pdf`,
      );
      setCombinedDrawingLoadingKey("");
      stopScanLoading();
    } catch {
      setCombinedDrawingLoadingKey("");
      stopScanLoading();
      showError(trans.kittingDrawingLoadFailed);
    }
  };

  const openLineDrawings = async (line: KittingLine) => {
    const lineKey = getLineKey(line);
    if (lineDrawingLoadingKey === lineKey) return;

    const documentEntries = getLineDocumentEntries(line);
    if (documentEntries.length === 0) {
      showError(trans.kittingNoDocumentsAvailableLabel);
      return;
    }

    setLineDrawingLoadingKey(lineKey);
    startScanLoading();

    try {
      await openMergedDrawingsPreview(
        documentEntries,
        `${trans.kittingPrintAllDrawingsLabel}: ${line.order}/${line.set}`,
        `kitting-${line.order}-${line.set}-line-${line.line}-${line.sequence}-drawings.pdf`,
      );
      setLineDrawingLoadingKey("");
      stopScanLoading();
    } catch {
      setLineDrawingLoadingKey("");
      stopScanLoading();
      showError(trans.kittingDrawingLoadFailed);
    }
  };

  const openLineComponentsList = async (line: KittingLine) => {
    const lineKey = getLineKey(line);
    if (lineComponentListLoadingKey === lineKey) return;

    setLineComponentListLoadingKey(lineKey);
    startScanLoading();

    try {
      const pdfBytes = buildLineComponentsPdf(line);
      openPdfPreview(
        pdfBytes,
        `${trans.kittingPrintListComponentsLabel}: ${line.order}/${line.set}`,
        `kitting-${line.order}-${line.set}-line-${line.line}-${line.sequence}-components.pdf`,
        [],
      );
      setLineComponentListLoadingKey("");
      stopScanLoading();
    } catch {
      setLineComponentListLoadingKey("");
      stopScanLoading();
      showError(trans.loadingDetails);
    }
  };

  const markCurrentDrawingAsPrinted = () => {
    if (drawingItemRaws.length === 0) return;
    setPrintedItems((current) => ({
      ...current,
      ...Object.fromEntries(drawingItemRaws.map((rawItem) => [rawItem, true])),
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {scanLoadingVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
          <div className="flex min-w-[220px] flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-8 py-6 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-gray-700" />
            <div className="text-sm font-medium text-gray-700">{trans.kittingLoading}</div>
          </div>
        </div>
      ) : null}

      <div className={scanLoadingVisible ? "pointer-events-none select-none" : undefined}>
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
            disabled={scanLoadingVisible}
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
                <div className="w-full md:w-[230px] md:flex-none">
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
                      disabled={scanLoadingVisible}
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

                <div className="flex-1">
                  <div className="relative pt-2">
                    <Input
                      value={orderSet}
                      onChange={(event) => {
                        setOrderSet(event.target.value);
                        if (!event.target.value.trim()) clearLoadedState();
                      }}
                      onBlur={() => {
                        if (orderSet.trim()) {
                          void lookupOrderSet();
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void lookupOrderSet();
                        }
                      }}
                      placeholder={trans.scanOrderSetPlaceholder}
                      className="h-12 border-gray-300 text-base"
                      disabled={scanLoadingVisible}
                    />
                    <label className="pointer-events-none absolute left-3 top-0 rounded-sm bg-white px-1 text-xs text-gray-700">
                      {trans.orderSetLabel}
                    </label>
                  </div>
                </div>

                {loadedKey && lines.length > 0 ? (
                  <div className="pt-2 md:flex-none">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-12 shrink-0 whitespace-nowrap rounded-md bg-green-100 px-3 text-green-700 hover:bg-green-200 hover:text-green-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100 disabled:hover:text-gray-400"
                      onClick={() => void openAllLoadedDrawings()}
                      disabled={scanLoadingVisible || combinedDrawingLoadingKey === "all" || isLoadedDocumentsMetaLoading() || getLoadedDocumentEntries().length === 0}
                    >
                      {combinedDrawingLoadingKey === "all" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="mr-2 h-4 w-4" />
                      )}
                      {trans.kittingPrintAllDocumentsLabel}
                    </Button>
                  </div>
                ) : null}
              </div>

            </div>
          </Card>

          {infoMessage ? (
            <Card className="rounded-xl border-2 border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-md shadow-gray-300/70">
              {infoMessage}
            </Card>
          ) : null}

          {lines.map((line) => {
              const hasComponents = line.components.length > 0;
              const lineOriginOption =
                findKittingOriginOptionByEnglishLabel(originOptions, line.orderOrigin) ||
                getKittingOriginOption(line.orderOrigin, line.orderOrigin, lang);
              const lineKey = getLineKey(line);
              const showRushBadge = line.rushOrder.toLowerCase() === "yes";
              const escalationLevel = line.salesOrderLineDetails?.escalationLevel?.trim() || "";
              const normalizedEscalationLevel = escalationLevel.toLowerCase();
              const escalationBadgeClass =
                normalizedEscalationLevel === "knocknoc"
                  ? "bg-red-500 text-white"
                  : normalizedEscalationLevel === "knoc"
                    ? "bg-orange-500 text-white"
                    : normalizedEscalationLevel === "urgent"
                      ? "bg-yellow-300 text-yellow-950"
                      : "";
              const showEscalationBadge = !!escalationBadgeClass;

              return (
                <Card
                  key={lineKey}
                  className={`relative rounded-xl border-2 bg-white p-6 shadow-md shadow-gray-300/70 ${
                    showRushBadge ? "border-red-300" : "border-gray-200"
                  }`}
                >
                  {showRushBadge ? (
                    <div className="pointer-events-none absolute right-6 -top-4">
                      <span className="inline-flex items-center rounded-full bg-red-100 px-4 py-1.5 text-base font-bold text-red-700 whitespace-nowrap">
                        Rush
                      </span>
                    </div>
                  ) : null}

                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
                            style={{
                              backgroundColor: lineOriginOption.style.bg,
                              color: lineOriginOption.style.text,
                            }}
                          >
                            {lineOriginOption.label}
                          </span>
                          <span className="font-semibold text-gray-900">{line.order}</span>
                          <span className="font-semibold text-gray-900">{line.set}</span>
                        </div>

                        <span className="text-gray-400">|</span>

                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                            <span className="text-gray-600">{trans.lineLabel}:</span>
                            <span className="font-semibold text-gray-900">{line.line}</span>
                            <span className="text-gray-600">{trans.sequenceLabel}:</span>
                            <span className="font-semibold text-gray-900">{line.sequence}</span>
                          </div>
                        </div>

                        {showEscalationBadge ? (
                          <>
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${escalationBadgeClass}`}
                            >
                              {escalationLevel}
                            </span>
                            <span className="text-gray-400">|</span>
                          </>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                          <span className="text-gray-600">Qty:</span>
                          <span className="font-semibold text-gray-900">
                            {line.orderedQuantity} {line.orderUnit}
                          </span>
                        </div>

                        <span className="text-gray-400">|</span>

                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="whitespace-nowrap text-gray-600">{trans.kittingMainItemLabel}:</span>

                          <span className="font-semibold text-gray-900">{formatItemNumber(line.item)}</span>
                          {line.itemDescription && (
                            <span className="font-semibold text-gray-900">{line.itemDescription}</span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 shrink-0 rounded-md bg-orange-100 text-orange-600 hover:bg-orange-200 hover:text-orange-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100 disabled:hover:text-gray-400"
                            onClick={() => void openDrawing(line.itemRaw, line.item)}
                            aria-label={`${trans.kittingDrawingTitle} ${formatItemNumber(line.item)}`}
                            disabled={isDrawingButtonDisabled(line.itemRaw)}
                          >
                            {drawingLoadingKey === `${line.item}|${line.itemRaw}` ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <FileImage className="h-5 w-5" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        {printedItems[line.itemRaw] && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-sm font-semibold text-green-700 whitespace-nowrap">
                            <Check className="h-4 w-4 stroke-[3]" />
                            {trans.kittingPrintedYesLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {hasComponents ? (
                      <>
                        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div>
                              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                {trans.kittingInspectionLabel}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-gray-900">
                                {formatDate(line.itemCreationDate)}
                              </div>
                            </div>

                            <span className="hidden h-10 w-px bg-gray-300 lg:block" />

                            <div>
                              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                {trans.kittingLastRevisionLabel}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-gray-900">
                                {formatDate(line.itemLastModificationDate)}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-10 shrink-0 whitespace-nowrap rounded-md bg-orange-100 px-3 text-orange-700 hover:bg-orange-200 hover:text-orange-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100 disabled:hover:text-gray-400"
                              onClick={() => void openLineDrawings(line)}
                              disabled={lineDrawingLoadingKey === lineKey || getLineDocumentEntries(line).length === 0}
                            >
                              {lineDrawingLoadingKey === lineKey ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Printer className="mr-2 h-4 w-4" />
                              )}
                              {trans.kittingPrintAllDrawingsLabel}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-10 shrink-0 whitespace-nowrap rounded-md bg-sky-100 px-3 text-sky-700 hover:bg-sky-200 hover:text-sky-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100 disabled:hover:text-gray-400"
                              onClick={() => void openLineComponentsList(line)}
                              disabled={lineComponentListLoadingKey === lineKey}
                            >
                              {lineComponentListLoadingKey === lineKey ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Printer className="mr-2 h-4 w-4" />
                              )}
                              {trans.kittingPrintListComponentsLabel}
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 text-gray-800">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold">{trans.kittingBomLineLabel}</th>
                                <th className="px-4 py-3 text-left font-semibold">{trans.kittingComponentLabel}</th>
                                <th className="px-4 py-3 text-right font-semibold">{trans.quantityLabel}</th>
                                <th className="px-4 py-3 text-left font-semibold">{trans.kittingDrawingOnFileLabel}</th>
                                <th className="px-4 py-3 text-left font-semibold">{trans.kittingCommentsInstructionsLabel}</th>
                                <th className="px-4 py-3 text-left font-semibold">{trans.kittingDrawingFileNameLabel}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {line.components.map((component) => (
                                <tr key={`${component.bomLine}-${component.component}`} className="border-t border-gray-200 align-top">
                                  <td className="px-4 py-3 font-medium text-gray-900">{component.bomLine}</td>
                                  <td className="px-4 py-3 text-gray-900">
                                    <div className="flex items-start gap-2">
                                      <div>
                                        <div className="font-medium">{formatItemNumber(component.component)}</div>
                                        {component.description && (
                                          <div className="text-xs text-gray-500">{component.description}</div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="mt-[-2px] h-10 w-10 shrink-0 rounded-md bg-orange-100 text-orange-600 hover:bg-orange-200 hover:text-orange-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100 disabled:hover:text-gray-400"
                                          onClick={() => void openDrawing(component.componentRaw, component.component)}
                                          aria-label={`${trans.kittingDrawingTitle} ${formatItemNumber(component.component)}`}
                                          disabled={isDrawingButtonDisabled(component.componentRaw)}
                                        >
                                          {drawingLoadingKey === `${component.component}|${component.componentRaw}` ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                          ) : (
                                            <FileImage className="h-5 w-5" />
                                          )}
                                        </Button>
                                        {printedItems[component.componentRaw] && (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-sm font-semibold text-green-700 whitespace-nowrap">
                                            <Check className="h-4 w-4 stroke-[3]" />
                                            {trans.kittingPrintedYesLabel}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                                    {formatQuantityWithUnit(component.quantity, component.inventoryUnit)}
                                  </td>
                                  <td className="px-4 py-3 text-gray-900">
                                    <span
                                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                        component.drawingOnFile.toLowerCase() === "yes"
                                          ? "bg-green-100 text-green-800"
                                          : component.drawingOnFile.toLowerCase() === "no"
                                            ? "bg-gray-100 text-gray-700"
                                            : "bg-gray-50 text-gray-700"
                                      }`}
                                    >
                                      {component.drawingOnFile || "-"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-900">{component.commentsInstructions}</td>
                                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                                    {isDrawingFilenameLoading(component.componentRaw) ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                    ) : (
                                      getDrawingFilename(component.componentRaw)
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex justify-end">
                          <div className="inline-flex items-center gap-4 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-900">
                            <span>{trans.kittingTotalPartsLabel}</span>
                            <span>{line.components.length}</span>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </Card>
              );
            })}
        </div>
      </div>

      <ItemDrawingDialog
        open={drawingOpen}
        onOpenChange={setDrawingOpen}
        title={drawingTitle}
        pdfUrl={drawingUrl}
        filename={drawingFilename}
        openInNewTabLabel={trans.kittingOpenDrawingLabel}
        printLabel={trans.kittingPrintLabel}
        onPrint={markCurrentDrawingAsPrinted}
      />

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
    </div>
  );
};

export default KittingDocs;
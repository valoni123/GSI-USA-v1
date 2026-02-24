"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { t, type LanguageKey } from "@/lib/i18n";
import { showLoading, dismissToast } from "@/utils/toast";

type Reason = {
  Reason: string;
  Description?: string;
  ReasonType?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (reasonCode: string) => void;
  onLoaded?: (reasons: Reason[]) => void;
  company?: string; // optional override
  language?: string;
};

const ReasonPickerDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  onSelect,
  onLoaded,
  company = "1100",
  language = "en-US",
}) => {
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const currentLang = (localStorage.getItem("app.lang") as LanguageKey) || "en";
  const trans = t(currentLang);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const tid = showLoading(trans.pleaseWait);
      const { data, error } = await supabase.functions.invoke("ln-reasons-list", {
        body: { company, language },
      });
      dismissToast(tid as unknown as string);
      setLoading(false);
      const list = Array.isArray(data?.value) ? (data?.value as Reason[]) : [];
      setReasons(list);
      if (onLoaded) onLoaded(list);
    };
    void load();
  }, [open, company, language]);

  const filtered = reasons.filter((r) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    const code = (r.Reason || "").toLowerCase();
    const desc = (r.Description || "").toLowerCase();
    return code.includes(q) || desc.includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{trans.rejectReasonLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder={trans.searchReasonPlaceholder}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10"
          />
          <ScrollArea className="max-h-80">
            {loading ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">{trans.loadingEntries}</div>
            ) : filtered.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">{trans.noReasonsLabel}</div>
            ) : (
              <div className="space-y-2">
                {filtered.map((r, idx) => (
                  <button
                    key={`${r.Reason || "reason"}-${idx}`}
                    type="button"
                    className="w-full text-left rounded-md border p-2 bg-white hover:bg-gray-50"
                    onClick={() => onSelect(r.Reason)}
                  >
                    <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                      <div className="flex flex-col">
                        <div className="text-sm text-gray-900 font-medium break-all">{r.Reason || "-"}</div>
                        {r.Description && <div className="text-xs text-gray-700">{r.Description}</div>}
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">{r.ReasonType || ""}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReasonPickerDialog;
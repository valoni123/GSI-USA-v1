import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { type LanguageKey, t } from "@/lib/i18n";

const TransportGroup = () => {
  const { group } = useParams();
  const navigate = useNavigate();
  const lang: LanguageKey = ((localStorage.getItem("app.lang") as LanguageKey) || "en");
  const trans = useMemo(() => t(lang), [lang]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            aria-label={trans.back}
            onClick={() => navigate("/menu")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="font-bold text-lg">{trans.planningGroupTransport}: {group}</div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Placeholder content until service is provided */}
        <div className="rounded-md border bg-white p-4">
          <div className="text-sm text-muted-foreground">
            Transport group details will appear here.
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransportGroup;
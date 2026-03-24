import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { BellRing } from "lucide-react";
import { useTransportPlanningAlert } from "@/components/TransportPlanningAlertProvider";
import { type LanguageKey, t } from "@/lib/i18n";

type MenuPosition = {
  top: number;
  left: number;
};

const MENU_WIDTH = 184;

const TransportPlanningBell = () => {
  const navigate = useNavigate();
  const { count, hasVehicle } = useTransportPlanningAlert();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 12 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const lang = ((localStorage.getItem("app.lang") as LanguageKey | null) || "en") as LanguageKey;
  const trans = useMemo(() => t(lang), [lang]);

  const displayCount = count > 99 ? "99+" : String(count);

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - MENU_WIDTH / 2, 12),
      window.innerWidth - MENU_WIDTH - 12,
    );

    setPosition({
      top: rect.bottom + 8,
      left,
    });
  };

  useEffect(() => {
    if (!open) return;

    updatePosition();

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const onReposition = () => {
      updatePosition();
    };

    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (!hasVehicle) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="relative inline-flex h-5 w-5 items-center justify-center rounded-sm"
        aria-label={`Transport notifications: ${count}`}
        onClick={() => {
          if (!open) updatePosition();
          setOpen((current) => !current);
        }}
      >
        <BellRing className={count > 0 ? "h-4 w-4 text-red-500 animate-bell-ring" : "h-4 w-4 text-gray-300"} />
        {count > 0 && (
          <span className="absolute -right-2 -top-2 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white shadow-sm">
            {displayCount}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close transport notifications"
                className="fixed inset-0 z-[70] bg-black/10 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <div
                className="fixed z-[80] w-[184px] rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
                style={{ top: position.top, left: position.left }}
              >
                <button
                  type="button"
                  className="w-full rounded-lg bg-gray-50 px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-100"
                  onClick={() => {
                    setOpen(false);
                    navigate("/menu/transports");
                  }}
                >
                  ({count}) {trans.appTransports}
                </button>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
};

export default TransportPlanningBell;

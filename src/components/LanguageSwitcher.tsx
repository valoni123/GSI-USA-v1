import { useMemo } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, type LanguageKey, t } from "@/lib/i18n";

type Props = {
  value: LanguageKey;
  onChange: (lang: LanguageKey) => void;
  mode?: "fixed" | "overlap";
};

const LanguageSwitcher = ({ value, onChange, mode = "fixed" }: Props) => {
  const containerClasses =
    mode === "fixed"
      ? "fixed inset-x-0 bottom-4 flex items-center justify-center"
      : "absolute -bottom-10 left-1/2 -translate-x-1/2";

  const current = useMemo(() => LANGUAGES.find((l) => l.key === value), [value]);
  const trans = useMemo(() => t(value), [value]);

  return (
    <div className={containerClasses}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-background/80 backdrop-blur border shadow-sm gap-2"
            aria-label={trans.changeLanguage}
          >
            <Globe className="h-4 w-4" />
            <span aria-hidden className="leading-none">
              {current?.flag}
            </span>
            <span className="font-medium">{trans.changeLanguage}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="center" sideOffset={8}>
          <DropdownMenuLabel>{trans.changeLanguage}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as LanguageKey)}>
            {LANGUAGES.map((l) => (
              <DropdownMenuRadioItem key={l.key} value={l.key}>
                <span className="mr-2" aria-hidden>
                  {l.flag}
                </span>
                {l.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default LanguageSwitcher;
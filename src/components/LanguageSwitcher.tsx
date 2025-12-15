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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  value: LanguageKey;
  onChange: (lang: LanguageKey) => void;
};

const LanguageSwitcher = ({ value, onChange }: Props) => {
  return (
    <div className="fixed inset-x-0 bottom-4 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-background/80 backdrop-blur border shadow px-2 py-1">
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full"
                    aria-label="Change language"
                  >
                    <Globe className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t(value).language}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenuContent align="center" sideOffset={6}>
            <DropdownMenuLabel>{t(value).language}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={value}
              onValueChange={(v) => onChange(v as LanguageKey)}
            >
              {LANGUAGES.map((l) => (
                <DropdownMenuRadioItem key={l.key} value={l.key}>
                  <span className="mr-2" aria-hidden>{l.flag}</span>
                  {l.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="text-xs font-medium tabular-nums px-2 py-1 rounded-md bg-muted">
          {
            LANGUAGES.find((l) => l.key === value)?.short
          }
        </div>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
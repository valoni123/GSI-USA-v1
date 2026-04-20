import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LanguageKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  lang: LanguageKey;
  onSubmit: (payload: { username: string; password: string; transportscreen?: boolean }) => void;
  logoSrc?: string;
};

const LoginForm = ({ lang, onSubmit, logoSrc = "/logo.png" }: Props) => {
  const trans = useMemo(() => t(lang), [lang]);

  const [username, setUsername] = useState("");
  const [resolvedFullName, setResolvedFullName] = useState<string | null>(null);
  const [resolvedIsAdmin, setResolvedIsAdmin] = useState(false);
  const [usernameLookup, setUsernameLookup] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const [password, setPassword] = useState("");
  const [transportScreen, setTransportScreen] = useState(false);

  const canSubmit = Boolean(resolvedFullName && password.trim().length > 0);
  const passwordDisabled = usernameLookup === "notfound";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ username, password, transportscreen: resolvedIsAdmin && transportScreen });
  };

  const usernameLabel = (
    <span>
      {trans.username}
      {usernameLookup === "found" && resolvedFullName ? (
        <span> - {resolvedFullName}</span>
      ) : usernameLookup === "notfound" ? (
        <span>
          {" "}- <span className="text-red-600">NOT FOUND</span>
        </span>
      ) : null}
    </span>
  );

  return (
    <div className="w-full max-w-md">
      <Card className="rounded-none border border-black/80 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="w-full flex flex-col items-center mb-6">
            <img
              src={logoSrc}
              alt="App logo"
              className="h-32 sm:h-40 md:h-48 object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingLabelInput
              id="username"
              label={usernameLabel}
              autoFocus
              value={username}
              onChange={(e) => {
                const v = e.target.value;
                setUsername(v);
                if (resolvedFullName) setResolvedFullName(null);
                if (resolvedIsAdmin) setResolvedIsAdmin(false);
                if (transportScreen) setTransportScreen(false);
                if (usernameLookup !== "idle") setUsernameLookup("idle");
              }}
              onBlur={async () => {
                const raw = username.trim();
                if (!raw) {
                  setResolvedFullName(null);
                  setResolvedIsAdmin(false);
                  setTransportScreen(false);
                  setUsernameLookup("idle");
                  return;
                }

                setUsernameLookup("loading");
                const requested = raw;
                const { data } = await supabase.functions.invoke("gsi-get-user-name", {
                  body: { username: requested },
                });

                if (username.trim() !== requested) return;

                const full = data && data.ok ? data.full_name : null;
                if (typeof full === "string" && full.trim().length > 0) {
                  setResolvedFullName(full.trim());
                  setResolvedIsAdmin(data?.admin === true);
                  if (data?.admin !== true) setTransportScreen(false);
                  setUsernameLookup("found");
                } else {
                  setResolvedFullName(null);
                  setResolvedIsAdmin(false);
                  setTransportScreen(false);
                  setUsernameLookup("notfound");
                  setPassword("");
                }
              }}
            />

            <FloatingLabelInput
              id="password"
              label={trans.password}
              type="password"
              value={password}
              disabled={passwordDisabled}
              onChange={(e) => setPassword(e.target.value)}
            />

            {resolvedIsAdmin && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Checkbox
                  id="transportScreen"
                  checked={transportScreen}
                  onCheckedChange={(v) => setTransportScreen(!!v)}
                />
                <label htmlFor="transportScreen" className="text-sm select-none">
                  {trans.transportScreen}
                </label>
              </div>
            )}

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-12 text-base bg-slate-900 hover:bg-slate-900/90 text-white disabled:bg-slate-400 disabled:hover:bg-slate-400"
            >
              {trans.signIn}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
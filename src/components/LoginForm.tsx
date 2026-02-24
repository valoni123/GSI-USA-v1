import { useState } from "react";
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
  const [username, setUsername] = useState("");
  const [usernameLabel, setUsernameLabel] = useState(t(lang).username);
  const [password, setPassword] = useState("");
  const [transportScreen, setTransportScreen] = useState(false);
  const trans = t(lang);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ username, password, transportscreen: transportScreen });
  };

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
                // Reset label to default while editing
                if (usernameLabel !== trans.username) {
                  setUsernameLabel(trans.username);
                }
              }}
              onBlur={async () => {
                const raw = username.trim();
                if (!raw) return;
                const { data } = await supabase.functions.invoke("gsi-get-user-name", {
                  body: { username: raw },
                });
                const full = data && data.ok ? data.full_name : null;
                if (typeof full === "string" && full.trim().length > 0) {
                  setUsernameLabel(`${trans.username} - ${full.trim()}`);
                } else {
                  setUsernameLabel(trans.username);
                }
              }}
            />

            <FloatingLabelInput
              id="password"
              label={trans.password}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

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

            <Button type="submit" className="w-full h-12 text-base bg-slate-900 hover:bg-slate-900/90 text-white">
              {trans.signIn}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
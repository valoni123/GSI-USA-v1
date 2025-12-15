import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { LanguageKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";

type Props = {
  lang: LanguageKey;
  onSubmit: (payload: { username: string; password: string }) => void;
  logoSrc?: string;
};

const LoginForm = ({ lang, onSubmit, logoSrc = "/logo.png" }: Props) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const trans = t(lang);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ username, password });
  };

  return (
    <div className="w-full max-w-sm">
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="p-0">
          <div className="w-full flex flex-col items-center mb-6">
            <img
              src={logoSrc}
              alt="App logo"
              className="h-20 sm:h-24 object-contain"
              onError={(e) => {
                // If no logo exists, hide the broken image icon gracefully
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="username">{trans.username}</Label>
              <Input
                id="username"
                name="username"
                inputMode="text"
                autoComplete="username"
                placeholder={trans.username}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">{trans.password}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <Button type="submit" className="w-full h-12 text-base">
              {trans.signIn}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import FloatingLabelInput from "@/components/FloatingLabelInput";
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
    <div className="w-full max-w-md">
      <Card className="rounded-none border border-black/80 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="w-full flex flex-col items-center mb-6">
            <img
              src={logoSrc}
              alt="App logo"
              className="h-32 sm:h-40 md:h-48 object-contain"
              onError={(e) => {
                // If no logo exists, hide the broken image icon gracefully
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingLabelInput
              id="username"
              label={trans.username}
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <FloatingLabelInput
              id="password"
              label={trans.password}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
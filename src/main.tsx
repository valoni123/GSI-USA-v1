import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <SonnerToaster />
  </>
);
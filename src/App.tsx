import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Menu from "./pages/Menu";
import IncomingMenu from "./pages/IncomingMenu";
import OutgoingMenu from "./pages/OutgoingMenu";
import OutgoingPicking from "./pages/OutgoingPicking";
import IncomingGoodsReceipt from "./pages/IncomingGoodsReceipt";
import IncomingInspection from "./pages/incominginspection";
import InfoStockMenu from "./pages/InfoStockMenu";
import InfoStockArticle from "./pages/InfoStockArticle";

import InfoStockTransfer from "./pages/InfoStockTransfer";
import InfoStockCorrection from "./pages/InfoStockCorrection";
import TransportMenu from "./pages/TransportMenu";
import InfoStockLEInfo from "./pages/InfoStockLEInfo";
import TransportLoad from "./pages/TransportLoad";
import TransportUnload from "./pages/TransportUnload";
import TransportSelect from "./pages/TransportSelect";
import TransportGroup from "./pages/TransportGroup";
import TransportsSelect from "./pages/TransportsSelect";
import TransportsList from "./pages/TransportsList";
import Docs from "./pages/Docs";
import { TransportPlanningAlertProvider } from "./components/TransportPlanningAlertProvider";

const queryClient = new QueryClient();

const hasStoredSession = () => {
  if (typeof window === "undefined") return false;
  const gsiId = (localStorage.getItem("gsi.id") || "").trim();
  const login = (localStorage.getItem("gsi.login") || "").trim();
  const token = (localStorage.getItem("ln.token") || "").trim();
  return Boolean(gsiId && login && token);
};

const ProtectedRoute = () => {
  const location = useLocation();

  if (!hasStoredSession()) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TransportPlanningAlertProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/docs" element={<Docs />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/menu" element={<Menu />} />
              <Route path="/menu/incoming" element={<IncomingMenu />} />
              <Route path="/menu/outgoing" element={<OutgoingMenu />} />
              <Route path="/menu/outgoing/picking" element={<OutgoingPicking />} />
              <Route path="/menu/incoming/goods-receipt" element={<IncomingGoodsReceipt />} />
              <Route path="/menu/incoming/inspection" element={<IncomingInspection />} />

              <Route path="/menu/info-stock" element={<InfoStockMenu />} />
              <Route path="/menu/info-stock/article" element={<InfoStockArticle />} />
              <Route path="/menu/info-stock/transfer" element={<InfoStockTransfer />} />
              <Route path="/menu/info-stock/correction" element={<InfoStockCorrection />} />
              <Route path="/menu/info-stock/le-info" element={<InfoStockLEInfo />} />
              <Route path="/menu/transport" element={<TransportMenu />} />
              <Route path="/menu/transport/load" element={<TransportLoad />} />
              <Route path="/menu/transport/unload" element={<TransportUnload />} />
              <Route path="/menu/transports" element={<TransportsSelect />} />
              <Route path="/menu/transports/list" element={<TransportsList />} />
              <Route path="/transport/select" element={<TransportSelect />} />
              <Route path="/transportgroup/:group" element={<TransportGroup />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TransportPlanningAlertProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
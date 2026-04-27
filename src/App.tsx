import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import {
  canAccessIncomingMenu,
  canAccessInfoStockMenu,
  canAccessOutgoingMenu,
  canAccessTransportMenus,
  clearStoredGsiPermissions,
  getStoredGsiPermissions,
  hasPermission,
  type GsiPermissions,
} from "@/lib/gsi-permissions";
import { clearStoredGsiAuth, hasStoredGsiIdentity } from "@/lib/gsi-auth-storage";
import { hasValidGsiSession } from "@/lib/gsi-session";
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
import KittingSelect from "./pages/KittingSelect";
import KittingOverview from "./pages/KittingOverview";
import TransportsSelect from "./pages/TransportsSelect";

import TransportsList from "./pages/TransportsList";
import KittingDocs from "./pages/KittingDocs";
import Docs from "./pages/Docs";

const queryClient = new QueryClient();

const hasStoredSession = () => hasStoredGsiIdentity() && hasValidGsiSession();

const ProtectedRoute = () => {
  const location = useLocation();

  if (!hasStoredSession()) {
    clearStoredGsiAuth();
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

const PermissionRoute = ({ allow }: { allow: (permissions: GsiPermissions) => boolean }) => {
  const location = useLocation();

  if (!hasStoredSession()) {
    clearStoredGsiAuth();
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  const permissions = getStoredGsiPermissions();

  if (!allow(permissions)) {
    clearStoredGsiPermissions();
    return <Navigate to="/menu" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/docs" element={<Docs />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/menu" element={<Menu />} />
            <Route path="/menu/kitting-docs" element={<KittingDocs />} />

            <Route element={<PermissionRoute allow={canAccessIncomingMenu} />}>
              <Route path="/menu/incoming" element={<IncomingMenu />} />
            </Route>
            <Route element={<PermissionRoute allow={(permissions) => hasPermission(permissions, "rece")} />}>
              <Route path="/menu/incoming/goods-receipt" element={<IncomingGoodsReceipt />} />
            </Route>
            <Route element={<PermissionRoute allow={(permissions) => hasPermission(permissions, "insp")} />}>
              <Route path="/menu/incoming/inspection" element={<IncomingInspection />} />
            </Route>

            <Route element={<PermissionRoute allow={canAccessOutgoingMenu} />}>
              <Route path="/menu/outgoing" element={<OutgoingMenu />} />
            </Route>
            <Route element={<PermissionRoute allow={(permissions) => hasPermission(permissions, "pick")} />}>
              <Route path="/menu/outgoing/picking" element={<OutgoingPicking />} />
            </Route>

            <Route element={<PermissionRoute allow={canAccessInfoStockMenu} />}>
              <Route path="/menu/info-stock" element={<InfoStockMenu />} />
            </Route>
            <Route element={<PermissionRoute allow={(permissions) => hasPermission(permissions, "itif")} />}>
              <Route path="/menu/info-stock/article" element={<InfoStockArticle />} />
            </Route>
            <Route element={<PermissionRoute allow={(permissions) => hasPermission(permissions, "trans")} />}>
              <Route path="/menu/info-stock/transfer" element={<InfoStockTransfer />} />
            </Route>
            <Route element={<PermissionRoute allow={(permissions) => hasPermission(permissions, "corr")} />}>
              <Route path="/menu/info-stock/correction" element={<InfoStockCorrection />} />
            </Route>
            <Route element={<PermissionRoute allow={(permissions) => hasPermission(permissions, "huif")} />}>
              <Route path="/menu/info-stock/le-info" element={<InfoStockLEInfo />} />
            </Route>

            <Route element={<PermissionRoute allow={canAccessTransportMenus} />}>
              <Route path="/menu/transport" element={<TransportMenu />} />
              <Route path="/menu/transports" element={<TransportsSelect />} />
              <Route path="/menu/transports/list" element={<TransportsList />} />
            </Route>
            <Route path="/kitting/select" element={<KittingSelect />} />
            <Route path="/kitting/overview" element={<KittingOverview />} />
            <Route path="/kitting/overview/:kittingId" element={<KittingOverview />} />
            <Route element={<PermissionRoute allow={(permissions) => hasPermission(permissions, "trlo")} />}>

              <Route path="/menu/transport/load" element={<TransportLoad />} />
              <Route path="/transport/select" element={<TransportSelect />} />
              <Route path="/transportgroup" element={<TransportGroup />} />
              <Route path="/transportgroup/:group" element={<TransportGroup />} />
            </Route>

            <Route element={<PermissionRoute allow={(permissions) => hasPermission(permissions, "trul")} />}>
              <Route path="/menu/transport/unload" element={<TransportUnload />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
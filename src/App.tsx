import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Menu from "./pages/Menu";
import IncomingMenu from "./pages/IncomingMenu";
import IncomingGoodsReceipt from "./pages/IncomingGoodsReceipt";
import InfoStockMenu from "./pages/InfoStockMenu";
import InfoStockArticle from "./pages/InfoStockArticle";
import InfoStockTransfer from "./pages/InfoStockTransfer";
import TransportMenu from "./pages/TransportMenu";
import InfoStockLEInfo from "./pages/InfoStockLEInfo";
import TransportLoad from "./pages/TransportLoad";
import TransportUnload from "./pages/TransportUnload";
import TransportSelect from "./pages/TransportSelect";
import TransportGroup from "./pages/TransportGroup";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/menu/incoming" element={<IncomingMenu />} />
          <Route path="/menu/incoming/goods-receipt" element={<IncomingGoodsReceipt />} />
          <Route path="/menu/info-stock" element={<InfoStockMenu />} />
          <Route path="/menu/info-stock/article" element={<InfoStockArticle />} />
          <Route path="/menu/info-stock/transfer" element={<InfoStockTransfer />} />
          <Route path="/menu/info-stock/le-info" element={<InfoStockLEInfo />} />
          <Route path="/menu/transport" element={<TransportMenu />} />
          <Route path="/menu/transport/load" element={<TransportLoad />} />
          <Route path="/menu/transport/unload" element={<TransportUnload />} />
          <Route path="/transport/select" element={<TransportSelect />} />
          <Route path="/transportgroup/:group" element={<TransportGroup />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
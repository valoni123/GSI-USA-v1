import { useRef } from "react";
import { Printer, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ItemDrawingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  pdfUrl: string;
  filename: string;
  openInNewTabLabel: string;
  printLabel: string;
  onPrint: () => void;
};

const ItemDrawingDialog = ({
  open,
  onOpenChange,
  title,
  pdfUrl,
  filename,
  openInNewTabLabel,
  printLabel,
  onPrint,
}: ItemDrawingDialogProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const handlePrint = () => {
    onPrint();
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-6xl rounded-lg bg-white p-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="truncate">{title}</DialogTitle>
              {filename && <div className="mt-1 text-sm text-gray-500 truncate">{filename}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="shrink-0 gap-2" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                {printLabel}
              </Button>
              <Button asChild variant="outline" className="shrink-0 gap-2">
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {openInNewTabLabel}
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="h-[78vh] w-full bg-gray-100">
          <iframe ref={iframeRef} src={pdfUrl} title={title} className="h-full w-full border-0" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ItemDrawingDialog;
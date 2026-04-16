import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type PackagingInstructionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text: string;
  footerText: string;
};

const PackagingInstructionsDialog = ({
  open,
  onOpenChange,
  title,
  text,
  footerText,
}: PackagingInstructionsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl overflow-hidden rounded-lg bg-white p-0">
        <DialogHeader className="border-b border-violet-200 bg-violet-100 px-6 py-4">
          <DialogTitle className="text-violet-950">{title}</DialogTitle>
        </DialogHeader>

        <div className="p-5">
          <ScrollArea className="max-h-[70vh] rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
            <div className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{text}</div>
          </ScrollArea>
        </div>

        {footerText ? (
          <div className="border-t border-violet-200 bg-violet-100 px-6 py-4 text-sm font-medium text-violet-950">
            {footerText}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default PackagingInstructionsDialog;
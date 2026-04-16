import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type PackagingInstructionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text: string;
};

const PackagingInstructionsDialog = ({
  open,
  onOpenChange,
  title,
  text,
}: PackagingInstructionsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl rounded-lg bg-white p-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] px-6 py-5">
          <div className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{text}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PackagingInstructionsDialog;

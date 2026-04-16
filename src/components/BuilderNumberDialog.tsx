import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BuilderNumberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  cancelLabel: string;
  confirmLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
};

const BuilderNumberDialog = ({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  cancelLabel,
  confirmLabel,
  value,
  onValueChange,
  onConfirm,
}: BuilderNumberDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm();
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900" htmlFor="builder-number-input">
              {label}
            </label>
            <Input
              id="builder-number-input"
              value={value}
              autoFocus
              onChange={(event) => onValueChange(event.target.value)}
              placeholder={placeholder}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button type="submit">{confirmLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BuilderNumberDialog;

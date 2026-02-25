"use client";

import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Yes",
  cancelLabel = "No",
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onCancel() : undefined)}>
      <DialogContent className="max-w-sm rounded-lg border bg-white p-0 shadow-lg [&>button]:hidden">
        <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
          {title}
        </div>
        <div className="px-4 py-4 text-sm text-gray-800">
          {message}
        </div>
        <div className="px-4 pb-4 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onCancel} className="h-9">{cancelLabel}</Button>
          <Button variant="destructive" onClick={onConfirm} className="h-9">{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDialog;
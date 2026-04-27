import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { Checkbox } from "@/components/ui/checkbox";

const KittingSelect = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [kittingId, setKittingId] = useState("");
  const [showAllKittings, setShowAllKittings] = useState(false);

  useEffect(() => {
    setOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) navigate("/menu");
        }}
      >
        <DialogContent
          className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Kittingscreen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-4 pt-2">
            <FloatingLabelInput
              id="kittingId"
              label="Kitting ID"
              value={kittingId}
              onChange={(e) => setKittingId(e.target.value)}
              autoFocus
              disabled={showAllKittings}
            />

            <div className="flex items-center gap-3 mt-1">
              <Checkbox
                id="showAllKittings"
                checked={showAllKittings}
                onCheckedChange={(value) => {
                  const next = Boolean(value);
                  setShowAllKittings(next);
                  if (next) setKittingId("");
                }}
              />
              <label htmlFor="showAllKittings" className="text-sm text-gray-800">
                SHOW ALL KITTINGS
              </label>
            </div>
          </div>

          <DialogFooter className="px-4 pb-4">
            <div className="w-full space-y-2">
              <Button
                className="w-full h-10 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => navigate("/menu")}
              >
                OK
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10"
                onClick={() => navigate("/menu")}
              >
                Cancel
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KittingSelect;

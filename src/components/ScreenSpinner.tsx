import React from "react";
import { Loader2 } from "lucide-react";

type ScreenSpinnerProps = {
  message?: string;
};

const ScreenSpinner: React.FC<ScreenSpinnerProps> = ({ message = "Please wait…" }) => {
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 bg-white rounded-xl px-6 py-5 shadow-lg">
        <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
        <div className="text-sm text-gray-700">{message}</div>
      </div>
    </div>
  );
};

export default ScreenSpinner;
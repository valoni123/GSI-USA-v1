import { BellRing } from "lucide-react";
import { useTransportPlanningAlert } from "@/components/TransportPlanningAlertProvider";

const TransportPlanningBell = () => {
  const { count, hasVehicle } = useTransportPlanningAlert();

  if (!hasVehicle) return null;

  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <div className="relative inline-flex h-5 w-5 items-center justify-center" aria-label={`Transport notifications: ${count}`}>
      <BellRing className={count > 0 ? "h-4 w-4 text-red-500 animate-bell-ring" : "h-4 w-4 text-gray-300"} />
      {count > 0 && (
        <span className="absolute -right-2 -top-2 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white shadow-sm">
          {displayCount}
        </span>
      )}
    </div>
  );
};

export default TransportPlanningBell;

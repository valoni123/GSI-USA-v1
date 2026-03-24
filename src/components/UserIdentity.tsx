import { User } from "lucide-react";
import TransportPlanningBell from "@/components/TransportPlanningBell";

type UserIdentityProps = {
  fullName: string;
  className?: string;
};

const UserIdentity = ({ fullName, className = "mt-2 flex items-center gap-2 text-sm text-gray-200" }: UserIdentityProps) => {
  return (
    <div className={className}>
      <User className="h-4 w-4 shrink-0" />
      <TransportPlanningBell />
      <span className="line-clamp-1">{fullName || ""}</span>
    </div>
  );
};

export default UserIdentity;

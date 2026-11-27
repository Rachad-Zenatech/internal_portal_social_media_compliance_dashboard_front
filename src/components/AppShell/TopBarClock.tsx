import { useEffect, useState } from "react";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { format } from "@/lib/userDates";
export default function TopBarClock() {
  const { time_zone } = useUserTimezone();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="mr-1 hidden flex-col items-end justify-center laptop:flex" title={`All dates shown in ${time_zone}`}>
      <span className="text-xs font-bold leading-tight">{format(now, "h:mm:ss a")}</span>
      <span className="mt-0.5 text-[10px] text-muted-foreground">{format(now, "MMM d, yyyy")} ? {time_zone}</span>
    </div>
  );
}

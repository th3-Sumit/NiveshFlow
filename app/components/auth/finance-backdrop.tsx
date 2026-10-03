import {
  Banknote,
  ChartNoAxesCombined,
  Coins,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  WalletCards,
} from "lucide-react";

const floatingIcons = [
  { icon: WalletCards, position: "-left-7 top-[19%] text-teal-600/20 lg:left-[2%]", size: 44, duration: "17s", delay: "-4s" },
  { icon: Coins, position: "right-[7%] top-[12%] text-teal-500/25", size: 40, duration: "19s", delay: "-11s" },
  { icon: Banknote, position: "-left-8 bottom-[17%] text-cyan-600/20 lg:left-[5%]", size: 46, duration: "16s", delay: "-7s" },
  { icon: PiggyBank, position: "-right-8 bottom-[7%] text-teal-600/20 lg:right-[3%]", size: 48, duration: "21s", delay: "-14s" },
  { icon: CreditCard, position: "left-[31%] top-[10%] hidden text-cyan-600/20 lg:block", size: 38, duration: "18s", delay: "-3s" },
  { icon: ChartNoAxesCombined, position: "left-[47%] top-[44%] hidden text-teal-500/20 lg:block", size: 40, duration: "20s", delay: "-12s" },
  { icon: Landmark, position: "right-[2%] top-[49%] hidden text-amber-600/20 lg:block", size: 42, duration: "22s", delay: "-8s" },
  { icon: TrendingUp, position: "bottom-[8%] left-[39%] hidden text-rose-500/20 lg:block", size: 40, duration: "15s", delay: "-5s" },
];

export function FinanceBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
      {floatingIcons.map(({ icon: Icon, position, size, duration, delay }) => (
        <span
          key={position}
          className={`absolute ${position} motion-safe:animate-auth-float motion-safe:group-focus-within/auth:[animation-play-state:paused]`}
          style={{ animationDuration: duration, animationDelay: delay }}
        >
          <Icon size={size} strokeWidth={1.5} />
        </span>
      ))}
    </div>
  );
}

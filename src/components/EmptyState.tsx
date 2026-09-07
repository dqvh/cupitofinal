import type { ReactNode } from "react";

interface EmptyStateProps {
  text: string;
  sub?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export default function EmptyState({ text, sub, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-black/[0.06] bg-white px-6 py-12 text-center shadow-xs">
      <p className="text-[15px] font-medium text-[#1D1D1F]">{text}</p>
      {sub && <p className="mt-1 text-xs text-[#6E6E73] max-w-sm">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

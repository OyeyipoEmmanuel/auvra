import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[15px] text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-[var(--brand-light)] focus:ring-2 focus:ring-[var(--brand)]/15",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

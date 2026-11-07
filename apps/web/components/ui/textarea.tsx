import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-32 w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[15px] leading-6 text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-[var(--brand-light)] focus:ring-2 focus:ring-[var(--brand)]/15",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

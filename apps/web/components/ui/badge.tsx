import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium uppercase tracking-[0.08em]",
  {
    variants: {
      variant: {
        default: "border-violet-400/20 bg-violet-400/10 text-violet-300",
        success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
        neutral: "border-white/10 bg-white/[.04] text-zinc-400",
        warning: "border-amber-300/20 bg-amber-300/10 text-amber-200",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };

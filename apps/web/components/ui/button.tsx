import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[15px] font-medium transition-colors duration-200 outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
  {
    variants: {
      variant: {
        default: "bg-white text-black hover:bg-zinc-200",
        violet: "bg-[var(--brand)] text-white hover:bg-[#753ce3]",
        outline:
          "border border-[var(--line)] bg-[var(--surface)] text-white hover:border-[#414147] hover:bg-[var(--surface-raised)]",
        ghost: "text-zinc-400 hover:bg-white/[.05] hover:text-white",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 rounded-lg px-3 text-[14px]",
        lg: "h-13 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };

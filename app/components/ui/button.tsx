import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/app/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold outline-none transition-[color,background-color,box-shadow,scale] duration-200 motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:ring-4 focus-visible:ring-teal-500/20 focus-visible:ring-offset-2 aria-invalid:border-rose-300 aria-invalid:ring-rose-500/15",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-11 px-5",
        icon: "size-10",
        lg: "h-12 px-6 text-sm",
        sm: "h-9 px-4 text-xs",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_3px_10px_rgba(0,152,140,0.20)] hover:bg-primary-hover",
        destructive:
          "border border-rose-200 bg-white !text-rose-600 hover:bg-rose-50",
        ghost:
          "text-slate-600 hover:bg-teal-50 hover:text-teal-800",
        outline:
          "border border-teal-200/70 bg-white/80 text-teal-800 shadow-sm hover:bg-teal-50",
        secondary:
          "border border-transparent bg-teal-50 text-teal-800 hover:bg-teal-100",
      },
    },
  },
);

function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

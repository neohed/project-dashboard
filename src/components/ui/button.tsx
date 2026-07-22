import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent-progress text-bg hover:brightness-110 font-medium",
  secondary: "bg-surface border border-border text-text hover:bg-surface-hover",
  ghost: "text-text-muted hover:text-text hover:bg-surface-hover",
  danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "primary", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
      variants[variant],
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";

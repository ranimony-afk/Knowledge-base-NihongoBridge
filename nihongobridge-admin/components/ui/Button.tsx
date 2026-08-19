import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  const tones = {
    primary: "border-ink bg-ink text-white hover:bg-black",
    secondary: "border-slate-200 bg-white text-ink hover:border-slate-300 hover:bg-slate-50",
    danger: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        size === "sm" ? "min-h-9 px-3 text-xs" : "min-h-10 px-4 text-sm"
      } ${tones[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

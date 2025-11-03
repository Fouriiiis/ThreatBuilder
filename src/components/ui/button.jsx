import React from "react";

const variantClasses = {
  default: "bg-neutral-900 text-white hover:bg-neutral-800 border-transparent",
  outline: "bg-transparent text-neutral-900 border-neutral-300 hover:bg-neutral-50",
  destructive: "bg-red-600 text-white hover:bg-red-500 border-transparent",
};

const sizeClasses = {
  sm: "h-8 px-2 py-1 text-xs",
  md: "h-10 px-4 py-2 text-sm",
};

export function Button({
  className = "",
  variant = "default",
  size = "md",
  type = "button",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-1 rounded-md border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const v = variantClasses[variant] ?? variantClasses.default;
  const s = sizeClasses[size] ?? sizeClasses.md;
  return (
    <button type={type} className={`${base} ${v} ${s} ${className}`} {...props} />
  );
}

export default Button;

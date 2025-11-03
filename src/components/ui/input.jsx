import React from "react";

export function Input({ className = "", ...props }) {
  const base =
    "h-9 px-3 py-1 rounded-md border border-neutral-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400";
  return <input className={`${base} ${className}`} {...props} />;
}

export default Input;

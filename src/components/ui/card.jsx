import React from "react";

export function Card({ className = "", ...props }) {
  return <div className={`bg-white rounded-2xl ${className}`} {...props} />;
}

export function CardHeader({ className = "", ...props }) {
  return (
    <div className={`border-b border-neutral-200 ${className}`} {...props} />
  );
}

export function CardContent({ className = "", ...props }) {
  return <div className={className} {...props} />;
}

export default Card;

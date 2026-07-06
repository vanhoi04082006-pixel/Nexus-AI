"use client";

/**
 * EmptyState — Reusable empty state component.
 *
 * Shows when a list/section has no data. Includes icon, title,
 * description, and optional action button.
 *
 * Usage:
 *   <EmptyState icon={Inbox} title="Chưa có email" description="..." />
 */

import { memo, type ComponentType } from "react";
import type { LucideProps } from "lucide-react";

interface EmptyStateProps {
  icon: ComponentType<LucideProps>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

function EmptyStateImpl({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-primary/60" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export const EmptyState = memo(EmptyStateImpl);
EmptyState.displayName = "EmptyState";

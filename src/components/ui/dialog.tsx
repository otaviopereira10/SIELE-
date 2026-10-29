"use client";

import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  return (
    <RD.Root open={open} onOpenChange={(o) => (dismissible || o ? onOpenChange(o) : undefined)}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" />
        <RD.Content
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <RD.Title className="text-lg font-semibold text-ink">{title}</RD.Title>
            {dismissible ? (
              <RD.Close className="rounded-md p-1 text-ink-3 hover:bg-surface-2" aria-label="Cerrar">
                <X className="size-5" />
              </RD.Close>
            ) : null}
          </div>
          {description ? <RD.Description className="mt-2 text-ink-2">{description}</RD.Description> : <RD.Description className="sr-only">{String(title)}</RD.Description>}
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

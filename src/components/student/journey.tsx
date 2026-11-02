import Link from "next/link";
import { Check } from "lucide-react";
import type { JourneyStep } from "@/lib/student/next-step";
import { cn } from "@/lib/utils";

/** El camino completo: dónde está el estudiante y qué le queda. */
export function Journey({ steps }: { steps: JourneyStep[] }) {
  return (
    <nav aria-label="Su camino hacia el objetivo">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {steps.map((step, i) => (
          <li key={step.key}>
            <Link
              href={step.href}
              aria-current={step.state === "current" ? "step" : undefined}
              className={cn(
                "flex h-full items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                step.state === "current" ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                  step.state === "done" ? "bg-ok text-white" : step.state === "current" ? "bg-brand text-white" : "bg-surface-3 text-ink-2",
                )}
              >
                {step.state === "done" ? <Check className="size-4" aria-label="Hecho" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{step.title}</span>
                <span className="block truncate text-xs text-ink-3">{step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

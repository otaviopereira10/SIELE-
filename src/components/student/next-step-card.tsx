import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import type { NextStep } from "@/lib/student/next-step";
import { cn } from "@/lib/utils";

/** Lo primero que ve el estudiante: una sola cosa que hacer ahora, y por qué. */
export function NextStepCard({ step, children }: { step: NextStep; children?: ReactNode }) {
  const urgent = step.key === "resubmission";
  const calm = step.key === "done" || step.key === "waiting";
  return (
    <section
      aria-labelledby="next-step-title"
      className={cn("rounded-2xl border px-5 py-5 sm:px-6", urgent ? "border-danger/30 bg-danger-soft" : calm ? "border-line bg-surface" : "border-brand/25 bg-brand-soft")}
    >
      <p className={cn("text-sm font-medium", urgent ? "text-danger" : "text-ink-3")}>{urgent ? "Importante" : calm ? "Estado" : "Su siguiente paso"}</p>
      <h2 id="next-step-title" className="mt-0.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        {step.title}
      </h2>
      <p className="mt-1 max-w-2xl text-ink-2">{step.why}</p>
      {"href" in step ? (
        <ButtonLink href={step.href} size="lg" variant={urgent ? "danger" : "primary"} className="mt-4 w-full sm:w-auto">
          {step.label} <ArrowRight className="size-4" aria-hidden />
        </ButtonLink>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

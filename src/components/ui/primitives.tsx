import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn, paragraphs } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("print-card rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(20,20,30,0.04)]", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger" | "gold" | "blue" | "orange";
const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  brand: "bg-brand-soft text-brand border-brand/20",
  ok: "bg-ok-soft text-ok border-ok/20",
  warn: "bg-warn-soft text-warn border-warn/25",
  danger: "bg-danger-soft text-danger border-danger/20",
  gold: "bg-gold-soft text-gold border-gold/25",
  blue: "bg-blue-soft text-blue border-blue/20",
  orange: "bg-orange-soft text-orange border-orange/25",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", toneClass[tone], className)}>
      {children}
    </span>
  );
}

const alertIcon = { info: Info, ok: CheckCircle2, warn: AlertTriangle, danger: XCircle };
const alertTone = {
  info: "border-brand/25 bg-brand-soft text-brand",
  ok: "border-ok/25 bg-ok-soft text-ok",
  warn: "border-warn/30 bg-warn-soft text-warn",
  danger: "border-danger/25 bg-danger-soft text-danger",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof alertIcon;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = alertIcon[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", alertTone[tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 text-ink">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-sm font-medium text-ink-3">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-lg text-sm text-ink-3">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-sm text-ink-3">{label}</p>
      <p className={cn("mt-1 text-3xl font-semibold tabular-nums", tone === "danger" ? "text-danger" : tone === "ok" ? "text-ok" : "text-ink")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
    </Card>
  );
}

export function ProgressBar({ value, max = 100, tone = "brand", label }: { value: number; max?: number; tone?: "brand" | "ok" | "gold" | "blue" | "orange" | "danger"; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bar = { brand: "bg-brand", ok: "bg-ok", gold: "bg-gold", blue: "bg-blue", orange: "bg-orange", danger: "bg-danger" }[tone];
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width]", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Renderiza texto con el marcado mínimo del banco (párrafos, **negrita**, *cursiva*) sin HTML arbitrario. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {paragraphs(text).map((p, i) => (
        <p key={i}>{inline(p)}</p>
      ))}
    </div>
  );
}

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\n)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok === "\n") out.push(<br key={k++} />);
    else if (tok.startsWith("**")) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line bg-surface", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-line bg-surface-2/70 px-4 py-3 font-medium text-ink-2", className)}>{children}</th>;
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("border-b border-line px-4 py-3 align-top", className)}>
      {children}
    </td>
  );
}

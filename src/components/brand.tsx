import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca propia: bocadillo de diálogo con la virgulilla de la «ñ». No reproduce logotipos oficiales. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <rect x="2" y="3" width="36" height="28" rx="9" fill="#1d3557" />
      <path d="M12 31 L10 38 L19 31 Z" fill="#1d3557" />
      <path d="M11 14 q4.5 -5 9 0 t9 0" fill="none" stroke="#f2c14e" strokeWidth="3" strokeLinecap="round" />
      <path d="M12 23 h16" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", compact = false, inverted = false }: { href?: string; compact?: boolean; inverted?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-md" aria-label="SIELE Trainer Pro — inicio">
      <LogoMark />
      {!compact ? (
        <span className="leading-tight">
          <span className={cn("block text-[1.05rem] font-semibold tracking-tight", inverted ? "text-white" : "text-ink")}>
            SIELE Trainer <span className="text-accent">Pro</span>
          </span>
          <span className={cn("block text-[0.7rem]", inverted ? "text-white/70" : "text-ink-3")}>Preparación independiente</span>
        </span>
      ) : null}
    </Link>
  );
}

export function IndependenceNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-ink-3", className)}>
      SIELE Trainer Pro es un producto independiente de preparación. No está afiliado, certificado ni respaldado por SIELE,
      el Instituto Cervantes ni las universidades que lo promueven. Los resultados son estimaciones pedagógicas, no
      calificaciones oficiales.
    </p>
  );
}

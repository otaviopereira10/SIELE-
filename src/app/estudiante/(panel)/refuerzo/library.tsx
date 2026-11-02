"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import type { ModuleStatus } from "@/lib/exam/drill";
import { cn } from "@/lib/utils";

export interface LibraryCard {
  key: string;
  title: string;
  summary: string;
  level: string;
  minutes: number;
  activity: "grammar" | "vocabulary" | "receptive" | "writing" | "speaking";
  status: ModuleStatus;
  best: { score: number; max: number } | null;
  recommended: boolean;
  fits: boolean;
}

const ACTIVITY: Record<LibraryCard["activity"], string> = { grammar: "Gramática", vocabulary: "Vocabulario", receptive: "Comprensión", writing: "Escritura", speaking: "Oral" };
const STATUS_FILTER: { value: ModuleStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Sin empezar" },
  { value: "review", label: "Para repasar" },
  { value: "mastered", label: "Dominados" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("min-h-9 rounded-full border px-3 text-sm transition-colors", active ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:bg-surface-2")}
    >
      {children}
    </button>
  );
}

/** Con muchos temas, se muestran primero los que más convienen; el resto, a un clic. */
const FIRST_PAGE = 12;

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Biblioteca filtrable: por defecto, solo lo que sirve para el nivel que se necesita. */
export function Library({ cards, target }: { cards: LibraryCard[]; target: string | null }) {
  const [onlyMine, setOnlyMine] = useState(Boolean(target));
  const [activity, setActivity] = useState<LibraryCard["activity"] | "all">("all");
  const [status, setStatus] = useState<ModuleStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return cards.filter(
      (c) =>
        (!onlyMine || c.fits || c.recommended) &&
        (activity === "all" || c.activity === activity) &&
        (status === "all" || c.status === status) &&
        (!q || normalize(`${c.title} ${c.summary}`).includes(q)),
    );
  }, [cards, onlyMine, activity, status, query]);
  const shown = showAll ? visible : visible.slice(0, FIRST_PAGE);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input aria-label="Buscar un tema" type="search" placeholder="Buscar un tema: subjuntivo, conectores…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {target ? (
            <>
              <Chip active={onlyMine} onClick={() => setOnlyMine(true)}>
                Para mi objetivo ({target})
              </Chip>
              <Chip active={!onlyMine} onClick={() => setOnlyMine(false)}>
                Todos los niveles
              </Chip>
              <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
            </>
          ) : null}
          <Chip active={activity === "all"} onClick={() => setActivity("all")}>
            Todo
          </Chip>
          {(Object.keys(ACTIVITY) as LibraryCard["activity"][]).map((a) => (
            <Chip key={a} active={activity === a} onClick={() => setActivity(a)}>
              {ACTIVITY[a]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTER.map((s) => (
            <Chip key={s.value} active={status === s.value} onClick={() => setStatus(s.value)}>
              {s.label}
            </Chip>
          ))}
          <span className="ml-auto text-sm text-ink-3 tabular-nums" role="status">
            {visible.length === 1 ? "1 tema" : `${visible.length} temas`}
          </span>
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="Ningún tema coincide">Pruebe a quitar algún filtro.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((m) => (
            <Link key={m.key} href={`/estudiante/refuerzo/${m.key}`} className="group">
              <Card className={cn("flex h-full flex-col p-4 transition-shadow group-hover:shadow-md", m.status === "mastered" && "bg-ok-soft/40")}>
                <div className="flex flex-wrap gap-1.5">
                  {m.recommended ? <Badge tone="danger">Prioridad para usted</Badge> : null}
                  <Badge>{ACTIVITY[m.activity]}</Badge>
                  <Badge tone="brand">{m.level}</Badge>
                </div>
                <p className="mt-3 font-semibold">{m.title}</p>
                <p className="mt-1 hidden flex-1 text-sm text-ink-2 sm:block">{m.summary}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-ink-3 sm:mt-3">
                  <span>{m.minutes} min</span>
                  {m.status === "mastered" ? (
                    <span className="inline-flex items-center gap-1 font-medium text-ok">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Dominado
                    </span>
                  ) : m.status === "review" && m.best ? (
                    <span className="font-medium text-warn">
                      Para repasar · mejor resultado {m.best.score} de {m.best.max}
                    </span>
                  ) : null}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {shown.length < visible.length ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setShowAll(true)}>
            {visible.length - shown.length === 1 ? "Ver el tema restante" : `Ver los ${visible.length - shown.length} temas restantes`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

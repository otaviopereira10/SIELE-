"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { recordPlacement } from "@/app/estudiante/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, ProgressBar } from "@/components/ui/primitives";
import { PLACEMENT_BLOCKS } from "@/content/placement";
import { blockPassed, placementLevel } from "@/lib/diagnosis/placement";
import { prepareDrill } from "@/lib/exam/drill";
import { LEVEL_LABEL, levelRank } from "@/lib/exam/skills";

interface Answered {
  block: number;
  prompt: string;
  chosen: string | null;
  right: string;
  correct: boolean;
  explanation: string;
}

/**
 * Una pregunta por pantalla, de lo más fácil a lo más difícil. Se detiene en el primer nivel que no se
 * supera: así nadie pasa media hora ante preguntas que aún no puede contestar.
 */
export function PlacementTest({ seed, target, hasPlan }: { seed: number; target: string | null; hasPlan: boolean }) {
  // se fija al montar: la página se vuelve a pintar con otra semilla al guardar el resultado
  const [firstSeed] = useState(seed);
  const blocks = useMemo(() => PLACEMENT_BLOCKS.map((b, i) => ({ level: b.level, questions: prepareDrill(b.questions, firstSeed + i, b.questions.length) })), [firstSeed]);
  const [started, setStarted] = useState(false);
  const [block, setBlock] = useState(0);
  const [question, setQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [finished, setFinished] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const focusTarget = useRef<HTMLParagraphElement>(null);

  // al cambiar de pregunta, el botón pulsado desaparece: se lleva el foco a lo nuevo para no dejar perdido a nadie
  useEffect(() => {
    focusTarget.current?.focus();
  }, [started, finished, block, question]);

  const correctIn = (all: Answered[], index: number) => all.filter((a) => a.block === index && a.correct).length;
  const result = (all: Answered[]) => placementLevel(blocks.slice(0, block + 1).map((b, i) => ({ level: b.level, correct: correctIn(all, i) })));

  const save = (level: string) =>
    start(async () => {
      setSaveError(null);
      const res = await recordPlacement(level).catch(() => null);
      if (res?.ok) setSaved(true);
      else setSaveError(res?.error ?? "No se pudo guardar el resultado. Compruebe la conexión.");
    });

  const answer = (option: string | null) => {
    const q = blocks[block].questions[question];
    const right = q.options[q.answer];
    const next = [...answers, { block, prompt: q.prompt, chosen: option, right, correct: option === right, explanation: q.explanation }];
    setAnswers(next);
    if (question + 1 < blocks[block].questions.length) {
      setQuestion(question + 1);
      return;
    }
    if (blockPassed(correctIn(next, block)) && block + 1 < blocks.length) {
      setBlock(block + 1);
      setQuestion(0);
      return;
    }
    setFinished(true);
    save(result(next));
  };

  if (!started) {
    return (
      <Card>
        <CardHeader title="Antes de empezar" />
        <CardBody className="space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-ink-2">
            <li>Son entre 6 y 30 preguntas: la prueba termina cuando las preguntas ya son demasiado difíciles.</li>
            <li>No hay tiempo límite, no cuenta como nota y su profesora solo verá el nivel resultante.</li>
            <li>Si no sabe una respuesta, pulse «No lo sé». No adivine: el resultado será más útil.</li>
          </ul>
          <Button size="lg" className="w-full sm:w-auto" onClick={() => setStarted(true)}>
            Empezar la prueba <ArrowRight className="size-4" aria-hidden />
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (finished) {
    const level = result(answers);
    const wrong = answers.filter((a) => !a.correct);
    const rank = levelRank(level);
    const goal = levelRank(target);
    return (
      <div className="space-y-6">
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm text-ink-3">Su punto de partida</p>
            <p ref={focusTarget} tabIndex={-1} className="text-4xl font-semibold tracking-tight outline-none">
              {LEVEL_LABEL[level]}
            </p>
            <p className="text-ink-2">
              {goal < 0
                ? "Ahora elija el nivel que necesita y la plataforma le dirá qué estudiar."
                : rank >= goal
                  ? `Ya apunta al nivel ${target} en gramática y vocabulario. Un simulacro corregido dirá si también lo alcanza al escribir y al hablar.`
                  : hasPlan
                    ? `Para llegar a ${target}, conviene que su plan tenga en cuenta este resultado: puede actualizarlo en «Plan de estudio».`
                    : `Para llegar a ${target}, su plan empezará por lo que le falta afianzar e irá subiendo poco a poco.`}
            </p>
            <p className="text-sm text-ink-3">Es una orientación: mide gramática, vocabulario y comprensión de frases, no cómo habla o escribe. Puede repetirla cuando quiera.</p>
            {saveError ? (
              <Alert tone="danger" title="No se ha guardado">
                {saveError}{" "}
                <button type="button" className="underline" onClick={() => save(level)} disabled={pending}>
                  Volver a intentarlo
                </button>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {saved ? (
                <ButtonLink href={hasPlan ? "/estudiante" : "/estudiante/plan"} size="lg" className="w-full sm:w-auto">
                  {hasPlan ? "Ver mi siguiente paso" : "Crear mi plan"} <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              ) : (
                <Button size="lg" disabled className="w-full sm:w-auto">
                  {pending ? "Guardando su resultado…" : hasPlan ? "Ver mi siguiente paso" : "Crear mi plan"}
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
        {wrong.length ? (
          <Card>
            <CardHeader title="Aprenda de lo que ha fallado" description={wrong.length === 1 ? "Una pregunta para repasar." : `${wrong.length} preguntas para repasar.`} />
            <CardBody>
              <ul className="space-y-3">
                {wrong.map((a) => (
                  <li key={a.prompt} className="rounded-lg bg-surface-2 px-4 py-3 text-sm">
                    <p className="font-medium">{a.prompt}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-danger">
                      <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>Su respuesta: {a.chosen ?? "no lo sabía"}</span>
                    </p>
                    <p className="mt-0.5 flex items-start gap-1.5 text-ok">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>Respuesta correcta: {a.right}</span>
                    </p>
                    <p className="mt-1 text-ink-2">{a.explanation}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
        <p className="text-sm text-ink-3">
          <Link href="/estudiante/refuerzo" className="underline">
            Ver todas las lecciones
          </Link>
        </p>
      </div>
    );
  }

  const q = blocks[block].questions[question];
  const total = blocks[block].questions.length;
  return (
    <Card>
      <CardBody className="space-y-5">
        <div>
          <div className="mb-1.5 flex justify-between text-sm text-ink-3">
            <span>Nivel {blocks[block].level}</span>
            <span className="tabular-nums">
              Pregunta {question + 1} de {total}
            </span>
          </div>
          <ProgressBar value={question} max={total} label="Avance en este nivel" />
        </div>
        <p key={q.prompt} ref={focusTarget} tabIndex={-1} className="text-xl font-medium outline-none">
          {q.prompt}
        </p>
        <div className="grid gap-2">
          {q.options.map((o) => (
            <button key={o} type="button" onClick={() => answer(o)} className="min-h-12 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-brand hover:bg-brand-soft">
              {o}
            </button>
          ))}
          <button type="button" onClick={() => answer(null)} className="min-h-11 rounded-xl px-4 py-2 text-left text-ink-2 underline-offset-2 hover:underline">
            No lo sé
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

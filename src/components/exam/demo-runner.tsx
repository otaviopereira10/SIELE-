"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { DEMO_STEPS } from "@/content/demo";
import { SKILL_META } from "@/lib/exam/skills";
import type { PracticeCheckResult, RecordingInfo, ResponsePayload } from "@/lib/exam/types";
import { ExamFooter, ExamHeader, TaskTabs, TimerBox, useCountdown } from "./chrome";
import { TaskView } from "./task-view";
import type { MediaApi, OralApi } from "./types";

/** Recorrido de demostración: mismo motor de tareas que el examen real, sin servidor ni guardado. */
export function DemoRunner() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, ResponsePayload>>>({});
  const [feedback, setFeedback] = useState<Record<string, PracticeCheckResult>>({});
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [recordings, setRecordings] = useState<Record<string, Record<string, RecordingInfo>>>({});
  const [localAudio, setLocalAudio] = useState<string | null>(null);
  const [deadline] = useState(() => new Date(Date.now() + 15 * 60 * 1000).toISOString());
  const remaining = useCountdown(deadline, 0);

  const s = DEMO_STEPS[step];
  const taskAnswers = answers[s.task.id] ?? {};

  const media: MediaApi = useMemo(
    () => ({
      playsUsed: (k) => plays[`${s.task.id}:${k}`] ?? 0,
      maxPlays: () => s.task.max_audio_plays,
      requestAudio: async (k) => {
        const used = plays[`${s.task.id}:${k}`] ?? 0;
        if (s.task.max_audio_plays > 0 && used >= s.task.max_audio_plays) throw new Error("max_plays_reached");
        setPlays((p) => ({ ...p, [`${s.task.id}:${k}`]: used + 1 }));
        return { url: s.media[k].url, synthetic: Boolean(s.media[k].synthetic) };
      },
      imageUrl: (k) => s.media[k]?.url,
    }),
    [plays, s],
  );

  const oral: OralApi = {
    recordings: recordings[s.task.id] ?? {},
    linkedChoices: {},
    allowRerecord: true,
    micReady: true,
    upload: async (part, seg, blob, ms) => {
      // en la demostración la grabación se queda en el navegador
      setLocalAudio(URL.createObjectURL(blob));
      setRecordings((r) => ({ ...r, [s.task.id]: { ...(r[s.task.id] ?? {}), [`${part}/${seg}`]: { part_key: part, segment_key: seg, status: "verified", duration_ms: ms } } }));
    },
  };

  const check = () => {
    const items = s.questions.map((qq) => {
      const sel = taskAnswers[`q:${qq.id}`];
      const selected = sel && "option_id" in sel ? sel.option_id : null;
      const key = s.keys[qq.id];
      return { question_id: qq.id, position: qq.position, selected, correct_option_ids: key.correct, is_correct: selected != null && key.correct.includes(selected), explanation: key.explanation };
    });
    setFeedback((f) => ({ ...f, [s.task.id]: { task_id: s.task.id, items } }));
  };

  const objective = s.questions.length > 0;
  const tabs = DEMO_STEPS.map((d, i) => ({ position: i + 1, title: SKILL_META[d.skill].short, done: i < step, locked: false }));

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <ExamHeader title={SKILL_META[s.skill].label} subtitle="Demostración · no se guarda ninguna respuesta" skill={s.skill} />
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-10 sm:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <TaskTabs tabs={tabs.map((t) => ({ ...t, title: t.title }))} current={step + 1} skill={s.skill} onSelect={(p) => setStep(p - 1)} />
          <TimerBox seconds={remaining} label="Tiempo demo" />
        </div>
        <Alert tone="info" className="mb-6" title="Modo demostración">
          Recorra una tarea de cada prueba. En la plataforma real las respuestas se guardan en el servidor, el tiempo lo controla el servidor y las soluciones nunca se envían al navegador antes de tiempo.
        </Alert>
        <TaskView
          key={s.task.id}
          task={s.task}
          questions={s.questions}
          bank={s.bank}
          answers={taskAnswers}
          onAnswer={(k, v) => setAnswers((a) => ({ ...a, [s.task.id]: { ...(a[s.task.id] ?? {}), [k]: v } }))}
          readOnly={Boolean(feedback[s.task.id])}
          feedback={feedback[s.task.id]}
          media={media}
          skill={s.skill}
          mode="demo"
          oral={oral}
        />
        {objective && !feedback[s.task.id] ? (
          <Button className="mt-8" onClick={check}>
            Comprobar respuestas
          </Button>
        ) : null}
        {s.skill === "speaking" && localAudio ? (
          <div className="mt-6 rounded-xl border border-line p-4">
            <p className="mb-2 flex items-center gap-2 font-medium">
              <Info className="size-4" aria-hidden /> Escuche su grabación (solo en este dispositivo)
            </p>
            <audio src={localAudio} controls className="w-full" />
          </div>
        ) : null}
        {step === DEMO_STEPS.length - 1 ? (
          <div className="mt-10 rounded-xl bg-brand-soft p-5">
            <p className="font-semibold">¿Y después?</p>
            <p className="mt-1 text-ink-2">
              En la plataforma, la profesora evalúa los textos y las grabaciones con una rúbrica, marca ejemplos concretos y el sistema le propone un plan de estudio personalizado.
            </p>
            <Link href="/acceso" className="mt-3 inline-flex h-11 items-center rounded-lg bg-brand px-4 font-medium text-white">
              Acceder a la plataforma
            </Link>
          </div>
        ) : null}
      </main>
      <ExamFooter progressLabel={`${step + 1} / ${DEMO_STEPS.length}`} progress={(step + 1) / DEMO_STEPS.length}>
        {step > 0 ? (
          <Button variant="secondary" size="lg" onClick={() => setStep(step - 1)}>
            Anterior
          </Button>
        ) : null}
        {step < DEMO_STEPS.length - 1 ? (
          <Button variant="exam" size="lg" onClick={() => setStep(step + 1)}>
            Siguiente
          </Button>
        ) : (
          <Link href="/" className="inline-flex h-13 items-center rounded-md bg-accent px-6 font-medium text-white">
            Terminar
          </Link>
        )}
      </ExamFooter>
    </div>
  );
}

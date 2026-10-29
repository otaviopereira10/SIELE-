"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExamFooter, ExamHeader, TaskTabs } from "@/components/exam/chrome";
import { TaskView } from "@/components/exam/task-view";
import type { MediaApi, OralApi } from "@/components/exam/types";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/primitives";
import type { Skill } from "@/lib/exam/content-schema";
import { SKILL_META } from "@/lib/exam/skills";
import type { PracticeCheckResult, RecordingInfo, ResponsePayload, RunnerOption, RunnerQuestion, RunnerTask } from "@/lib/exam/types";

export interface PreviewSection {
  id: string;
  skill: Skill;
  title: string;
  tasks: { task: RunnerTask; questions: RunnerQuestion[]; bank: RunnerOption[]; keys: Record<string, { correct: string[]; explanation: string }> }[];
}

export function PreviewRunner({ title, sections, mediaUrls, backHref }: { title: string; sections: PreviewSection[]; mediaUrls: Record<string, { url: string; synthetic: boolean }>; backHref: string }) {
  const [si, setSi] = useState(0);
  const [ti, setTi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, ResponsePayload>>>({});
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [recs, setRecs] = useState<Record<string, Record<string, RecordingInfo>>>({});
  const [showKeys, setShowKeys] = useState(false);
  const section = sections[si];
  const entry = section?.tasks[ti];

  const media: MediaApi = useMemo(() => {
    const m = (entry?.task.content.media ?? {}) as Record<string, { asset_id: string; max_plays?: number }>;
    return {
      playsUsed: (k) => plays[`${entry?.task.id}:${k}`] ?? 0,
      maxPlays: (k) => m[k]?.max_plays ?? entry?.task.max_audio_plays ?? 2,
      requestAudio: async (k) => {
        const ref = m[k];
        const u = ref ? mediaUrls[ref.asset_id] : undefined;
        if (!u) throw new Error("media_not_found");
        setPlays((p) => ({ ...p, [`${entry?.task.id}:${k}`]: (p[`${entry?.task.id}:${k}`] ?? 0) + 1 }));
        return { url: u.url, synthetic: u.synthetic };
      },
      imageUrl: (k) => (m[k] ? mediaUrls[m[k].asset_id]?.url : undefined),
    };
  }, [entry, plays, mediaUrls]);

  if (!section || !entry) {
    return (
      <div className="p-8">
        <Alert tone="info" title="La versión no tiene tareas todavía." />
      </div>
    );
  }

  const feedback: PracticeCheckResult | null = showKeys
    ? {
        task_id: entry.task.id,
        items: entry.questions.map((q) => {
          const a = answers[entry.task.id]?.[`q:${q.id}`];
          const sel = a && "option_id" in a ? a.option_id : a && "option_ids" in a ? a.option_ids : null;
          const key = entry.keys[q.id];
          return {
            question_id: q.id,
            position: q.position,
            selected: sel,
            correct_option_ids: key?.correct ?? [],
            is_correct: Array.isArray(sel) ? key?.correct.every((c) => sel.includes(c)) && sel.length === key?.correct.length : Boolean(sel && key?.correct.includes(sel)),
            explanation: key?.explanation ?? "",
          };
        }),
      }
    : null;

  const oral: OralApi = {
    recordings: recs[entry.task.id] ?? {},
    linkedChoices: {},
    allowRerecord: true,
    micReady: true,
    upload: async (part, seg, _blob, ms) => {
      setRecs((r) => ({ ...r, [entry.task.id]: { ...(r[entry.task.id] ?? {}), [`${part}/${seg}`]: { part_key: part, segment_key: seg, status: "verified", duration_ms: ms } } }));
    },
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <ExamHeader
        title={SKILL_META[section.skill].label}
        subtitle={`Vista previa · ${title} · nada se guarda`}
        skill={section.skill}
        right={
          <Link href={backHref} className="text-sm text-white/80 underline">
            Salir
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-10 sm:px-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {sections.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSi(i);
                setTi(0);
              }}
              className={`rounded-full border px-3 py-1 text-sm ${i === si ? "border-ink bg-ink text-white" : "border-line"}`}
            >
              {SKILL_META[s.skill].short}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showKeys} onChange={(e) => setShowKeys(e.target.checked)} className="size-4" />
            Mostrar soluciones
          </label>
        </div>
        <div className="mb-6">
          <TaskTabs
            tabs={section.tasks.map((t, i) => ({ position: i + 1, title: t.task.title, done: false, locked: false }))}
            current={ti + 1}
            skill={section.skill}
            onSelect={(p) => setTi(p - 1)}
          />
        </div>
        <p className="mb-4 flex flex-wrap gap-2">
          <Badge>{entry.task.code}</Badge>
          {entry.task.level_label ? <Badge tone="brand">{entry.task.level_label}</Badge> : null}
          <Badge>{entry.task.declared_items} ítems</Badge>
        </p>
        <TaskView
          key={entry.task.id + String(showKeys)}
          task={entry.task}
          questions={entry.questions}
          bank={entry.bank}
          answers={answers[entry.task.id] ?? {}}
          onAnswer={(k, v) => setAnswers((a) => ({ ...a, [entry.task.id]: { ...(a[entry.task.id] ?? {}), [k]: v } }))}
          readOnly={false}
          feedback={feedback}
          media={media}
          skill={section.skill}
          mode="preview"
          oral={oral}
        />
      </main>
      <ExamFooter progressLabel={`${ti + 1} / ${section.tasks.length}`} progress={(ti + 1) / section.tasks.length}>
        <Button variant="secondary" size="lg" disabled={ti === 0} onClick={() => setTi(ti - 1)}>
          Anterior
        </Button>
        <Button variant="exam" size="lg" disabled={ti >= section.tasks.length - 1} onClick={() => setTi(ti + 1)}>
          Siguiente
        </Button>
      </ExamFooter>
    </div>
  );
}

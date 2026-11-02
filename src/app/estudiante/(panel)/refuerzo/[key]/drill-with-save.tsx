"use client";

import { Drill } from "@/components/refuerzo/drill";
import type { DrillExercise } from "@/content/refuerzo";

export function DrillWithSave({
  moduleKey,
  exercises,
  seed,
  save,
}: {
  moduleKey: string;
  exercises: DrillExercise[];
  seed: number;
  save: (moduleKey: string, score: number, max: number) => Promise<unknown>;
}) {
  return <Drill exercises={exercises} seed={seed} nextHref="/estudiante" nextLabel="Ver mi siguiente paso" onFinish={(score, max) => save(moduleKey, score, max)} />;
}

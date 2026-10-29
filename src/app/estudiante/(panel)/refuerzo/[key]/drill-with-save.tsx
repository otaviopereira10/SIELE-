"use client";

import { Drill } from "@/components/refuerzo/drill";
import type { DrillExercise } from "@/content/refuerzo";

export function DrillWithSave({
  moduleKey,
  exercises,
  save,
}: {
  moduleKey: string;
  exercises: DrillExercise[];
  save: (moduleKey: string, score: number, max: number) => Promise<unknown>;
}) {
  return <Drill exercises={exercises} onFinish={(score, max) => save(moduleKey, score, max)} />;
}

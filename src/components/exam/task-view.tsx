"use client";

import { Alert } from "@/components/ui/primitives";
import { DropdownGapTask, FragmentGapTask, MatchingTask, MultiSelectTask, SingleChoiceTask } from "./objective";
import { SpeakingTask } from "./speaking";
import type { TaskRendererProps } from "./types";
import { WritingTask } from "./writing";

/** Motor de presentación: elige el componente según el tipo de interacción de la tarea. */
export function TaskView(props: TaskRendererProps) {
  switch (props.task.interaction_type) {
    case "single_choice":
      return <SingleChoiceTask {...props} />;
    case "matching":
      return <MatchingTask {...props} />;
    case "dropdown_gap":
      return <DropdownGapTask {...props} />;
    case "fragment_gap":
      return <FragmentGapTask {...props} />;
    case "multi_select":
      return <MultiSelectTask {...props} />;
    case "writing":
      return <WritingTask {...props} />;
    case "speaking":
      return <SpeakingTask {...props} />;
    default:
      return <Alert tone="danger" title="Tipo de tarea no compatible" />;
  }
}

/** Ítems sin responder de una tarea (para avisar antes de avanzar o enviar). */
export function blankCount(props: Pick<TaskRendererProps, "task" | "questions" | "answers"> & { recordings?: Record<string, { status: string }> }): number {
  const { task, questions, answers } = props;
  if (task.interaction_type === "writing") {
    const a = answers["text"];
    return a && "text" in a && a.text.trim() ? 0 : 1;
  }
  if (task.interaction_type === "speaking") {
    return Object.values(props.recordings ?? {}).some((r) => r.status === "verified") ? 0 : 1;
  }
  return questions.filter((q) => {
    const a = answers[`q:${q.id}`];
    if (!a) return true;
    if ("option_id" in a) return !a.option_id;
    if ("option_ids" in a) return a.option_ids.length === 0;
    return true;
  }).length;
}

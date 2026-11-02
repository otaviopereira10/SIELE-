"use client";

import { Component, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { normalizeTaskContent } from "@/lib/exam/normalize";
import { DropdownGapTask, FragmentGapTask, MatchingTask, MultiSelectTask, SingleChoiceTask } from "./objective";
import { SpeakingTask, pendingSegments } from "./speaking";
import type { TaskRendererProps } from "./types";
import { WritingTask } from "./writing";

/** Un fallo al pintar una tarea no debe tirar todo el examen: se avisa y se puede reintentar o seguir. */
export class TaskErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Alert tone="danger" title="No se pudo mostrar esta tarea">
        <p>Sus respuestas anteriores están guardadas. Pruebe a recargarla; si el problema continúa, pase a la siguiente tarea y avise a su profesora.</p>
        <Button size="sm" variant="secondary" className="mt-2" onClick={() => this.setState({ failed: false })}>
          Reintentar
        </Button>
      </Alert>
    );
  }
}

/** Motor de presentación: elige el componente según el tipo de interacción de la tarea. */
export function TaskView(props: TaskRendererProps) {
  const { task: rawTask } = props;
  const task = useMemo(() => ({ ...rawTask, content: normalizeTaskContent(rawTask.interaction_type, rawTask.content) }), [rawTask]);
  const view = { ...props, task };
  switch (task.interaction_type) {
    case "single_choice":
      return <SingleChoiceTask {...view} />;
    case "matching":
      return <MatchingTask {...view} />;
    case "dropdown_gap":
      return <DropdownGapTask {...view} />;
    case "fragment_gap":
      return <FragmentGapTask {...view} />;
    case "multi_select":
      return <MultiSelectTask {...view} />;
    case "writing":
      return <WritingTask {...view} />;
    case "speaking":
      return <SpeakingTask {...view} />;
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
    return pendingSegments(normalizeTaskContent("speaking", task.content), answers, props.recordings ?? {});
  }
  return questions.filter((q) => {
    const a = answers[`q:${q.id}`];
    if (!a) return true;
    if ("option_id" in a) return !a.option_id;
    if ("option_ids" in a) return a.option_ids.length === 0;
    return true;
  }).length;
}

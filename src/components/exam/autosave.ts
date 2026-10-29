"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorCode, isNetworkError } from "@/lib/exam/errors";
import type { ResponsePayload } from "@/lib/exam/types";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "offline" | "error";

interface PendingItem {
  taskId: string;
  itemKey: string;
  payload: ResponsePayload;
  dueAt: number;
}

type Saver = (taskId: string, itemKey: string, payload: ResponsePayload) => Promise<void>;

const FATAL = new Set(["time_expired", "section_not_active", "attempt_closed", "navigation_back_not_allowed", "task_already_checked", "attempt_locked_contact_teacher"]);

/**
 * Cola de guardado automático.
 * - Las respuestas se envían al servidor (fuente de verdad) con un pequeño retardo para los textos.
 * - Si no hay conexión, se conservan en este dispositivo (copia de seguridad) y se reintentan.
 * - Los rechazos definitivos del servidor (tiempo agotado, prueba cerrada) no se reintentan.
 */
export function useAutosave(storageKey: string | null, save: Saver, onFatal: (code: string) => void) {
  const queue = useRef(new Map<string, PendingItem>());
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const flushing = useRef<Promise<void> | null>(null);
  const timer = useRef<number | null>(null);
  const saveRef = useRef(save);
  const fatalRef = useRef(onFatal);
  useEffect(() => {
    saveRef.current = save;
    fatalRef.current = onFatal;
  }, [save, onFatal]);

  const persist = useCallback(() => {
    setPendingCount(queue.current.size);
    if (!storageKey) return;
    try {
      if (queue.current.size === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify([...queue.current.values()]));
    } catch {
      // almacenamiento no disponible (modo privado): el servidor sigue siendo la fuente de verdad
    }
  }, [storageKey]);

  const flush = useCallback(async (force = false): Promise<void> => {
    if (flushing.current) {
      await flushing.current;
      if (!force) return;
    }
    const run = (async () => {
      const now = Date.now();
      const due = [...queue.current.values()].filter((i) => force || i.dueAt <= now);
      if (due.length === 0) return;
      setStatus("saving");
      let offline = false;
      for (const item of due) {
        const k = `${item.taskId}|${item.itemKey}`;
        const current = queue.current.get(k);
        if (!current) continue;
        try {
          await saveRef.current(item.taskId, item.itemKey, current.payload);
          // solo se elimina si no cambió mientras se guardaba
          if (queue.current.get(k) === current) queue.current.delete(k);
        } catch (err) {
          if (isNetworkError(err)) {
            offline = true;
            break;
          }
          const code = errorCode(err);
          queue.current.delete(k);
          if (code && FATAL.has(code)) {
            fatalRef.current(code);
          } else {
            setStatus("error");
          }
        }
      }
      persist();
      if (offline) setStatus("offline");
      else if (queue.current.size === 0) {
        setStatus("saved");
        setLastSavedAt(new Date());
      } else setStatus("pending");
    })();
    flushing.current = run;
    try {
      await run;
    } finally {
      flushing.current = null;
    }
  }, [persist]);

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const next = Math.min(...[...queue.current.values()].map((i) => i.dueAt));
    if (!Number.isFinite(next)) return;
    timer.current = window.setTimeout(() => void flush(), Math.max(0, next - Date.now()));
  }, [flush]);

  const enqueue = useCallback(
    (taskId: string, itemKey: string, payload: ResponsePayload, debounceMs = 0) => {
      queue.current.set(`${taskId}|${itemKey}`, { taskId, itemKey, payload, dueAt: Date.now() + debounceMs });
      setStatus("pending");
      persist();
      schedule();
    },
    [persist, schedule],
  );

  // recuperar lo que quedó pendiente en este dispositivo (corte de luz, cierre accidental)
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        for (const item of JSON.parse(raw) as PendingItem[]) {
          queue.current.set(`${item.taskId}|${item.itemKey}`, { ...item, dueAt: Date.now() });
        }
        setPendingCount(queue.current.size);
        void flush(true);
      }
    } catch {
      // ignorar copias dañadas
    }
  }, [storageKey, flush]);

  useEffect(() => {
    const onOnline = () => void flush(true);
    const onOffline = () => queue.current.size > 0 && setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const retry = window.setInterval(() => {
      if (queue.current.size > 0 && navigator.onLine) void flush(true);
    }, 8000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(retry);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [flush]);

  return {
    enqueue,
    flush: () => flush(true),
    status,
    lastSavedAt,
    pendingCount,
    hasPending: () => queue.current.size > 0,
    pendingFor: (taskId: string) => [...queue.current.values()].filter((i) => i.taskId === taskId),
  };
}

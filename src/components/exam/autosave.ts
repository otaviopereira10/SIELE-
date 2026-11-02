"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classifySaveError, errorCode } from "@/lib/exam/errors";
import type { ResponsePayload } from "@/lib/exam/types";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "offline" | "error";

interface PendingItem {
  taskId: string;
  itemKey: string;
  payload: ResponsePayload;
  dueAt: number;
}

type Saver = (taskId: string, itemKey: string, payload: ResponsePayload) => Promise<void>;

/**
 * Cola de guardado automático.
 * - Las respuestas se envían al servidor (fuente de verdad) con un pequeño retardo para los textos.
 * - Ante un corte, una sesión caducada o un fallo temporal se conservan en este dispositivo y se reintentan.
 * - Solo se descartan los rechazos definitivos del servidor (tiempo agotado, prueba cerrada, dato no válido).
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

  /** Devuelve true si no queda nada pendiente de guardar. */
  const flush = useCallback(
    async (force = false): Promise<boolean> => {
      if (flushing.current) {
        await flushing.current;
        if (!force) return queue.current.size === 0;
      }
      const run = (async () => {
        const now = Date.now();
        const due = [...queue.current.values()].filter((i) => force || i.dueAt <= now);
        if (due.length === 0) return;
        setStatus("saving");
        let offline = false;
        let failed = false;
        let rejected = false;
        for (const item of due) {
          const k = `${item.taskId}|${item.itemKey}`;
          const current = queue.current.get(k);
          if (!current) continue;
          try {
            await saveRef.current(item.taskId, item.itemKey, current.payload);
            // solo se elimina si no cambió mientras se guardaba
            if (queue.current.get(k) === current) queue.current.delete(k);
          } catch (err) {
            const kind = classifySaveError(err);
            if (kind === "network") {
              offline = true;
              break;
            }
            if (kind === "session" || kind === "retry") {
              failed = true;
              break;
            }
            queue.current.delete(k);
            if (kind === "closed") fatalRef.current(errorCode(err) ?? "attempt_closed");
            else rejected = true;
          }
        }
        persist();
        if (offline) setStatus("offline");
        else if (failed || rejected) setStatus("error");
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
      return queue.current.size === 0;
    },
    [persist],
  );

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

  // funciones estables: se pueden usar como dependencias sin provocar recargas en cada renderizado
  const actions = useMemo(
    () => ({
      enqueue,
      flush: () => flush(true),
      hasPending: () => queue.current.size > 0,
      pendingFor: (taskId: string) => [...queue.current.values()].filter((i) => i.taskId === taskId),
    }),
    [enqueue, flush],
  );

  return { actions, status, lastSavedAt, pendingCount };
}

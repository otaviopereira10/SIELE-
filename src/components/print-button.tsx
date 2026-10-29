"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Abre el diálogo de impresión del navegador (permite guardar el informe como PDF). */
export function PrintButton({ children }: { children: ReactNode }) {
  return (
    <Button variant="secondary" className="no-print" onClick={() => window.print()}>
      {children}
    </Button>
  );
}

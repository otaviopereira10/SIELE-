import Link from "next/link";
import { Logo } from "@/components/brand";

export default function NotFound() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-lg flex-col items-start justify-center gap-4 px-6">
      <Logo />
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-ink-2">La dirección no existe o no tiene permiso para ver este contenido.</p>
      <Link href="/" className="inline-flex h-11 items-center rounded-lg bg-brand px-4 font-medium text-white">
        Volver al inicio
      </Link>
    </main>
  );
}

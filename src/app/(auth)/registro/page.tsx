import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/lib/env";
import { RegisterForm } from "../forms";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  await connection();
  if (!isSupabaseConfigured()) redirect("/configuracion");
  const { codigo } = await searchParams;
  return (
    <Card>
      <CardBody className="space-y-5 py-6">
        <div>
          <h1 className="text-2xl font-semibold">Crear cuenta con invitación</h1>
          <p className="mt-1 text-sm text-ink-2">El código determina su clase y su tipo de cuenta. No es posible elegir el rol.</p>
        </div>
        <RegisterForm code={codigo?.slice(0, 20)} />
      </CardBody>
    </Card>
  );
}

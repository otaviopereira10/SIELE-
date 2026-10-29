import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/primitives";
import { ResetRequestForm } from "../forms";

export const metadata: Metadata = { title: "Recuperar el acceso" };

export default function ResetPage() {
  return (
    <Card>
      <CardBody className="space-y-5 py-6">
        <div>
          <h1 className="text-2xl font-semibold">Recuperar el acceso</h1>
          <p className="mt-1 text-sm text-ink-2">Le enviaremos un enlace para definir una contraseña nueva.</p>
        </div>
        <ResetRequestForm />
      </CardBody>
    </Card>
  );
}

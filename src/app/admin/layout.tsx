import { AppShell, type NavItem } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  // las profesoras con permiso de autoría solo acceden al banco de simulacros (lo comprueba cada página)
  if (profile.role !== "admin" && !profile.canAuthor) redirect("/profesora");
  const nav: NavItem[] =
    profile.role === "admin"
      ? [
          { href: "/admin", label: "Estado", icon: "home", exact: true },
          { href: "/admin/usuarios", label: "Usuarios y roles", icon: "users" },
          { href: "/admin/clases", label: "Clases", icon: "classes" },
          { href: "/admin/invitaciones", label: "Invitaciones", icon: "invitations" },
          { href: "/admin/simulacros", label: "Banco de simulacros", icon: "bank" },
          { href: "/admin/multimedia", label: "Multimedia", icon: "media" },
          { href: "/admin/rubricas", label: "Rúbricas", icon: "rubrics" },
          { href: "/admin/fuentes", label: "Fuentes y metodología", icon: "sources" },
          { href: "/admin/auditoria", label: "Auditoría", icon: "audit" },
          { href: "/admin/datos", label: "Datos, IA y retención", icon: "data" },
          { href: "/profesora/correcciones", label: "Correcciones", icon: "grading" },
          { href: "/profesora/manual", label: "Manual de evaluación", icon: "manual" },
        ]
      : [
          { href: "/admin/simulacros", label: "Banco de simulacros", icon: "bank" },
          { href: "/admin/multimedia", label: "Multimedia", icon: "media" },
          { href: "/profesora", label: "Volver a mi panel", icon: "home", exact: true },
        ];
  return (
    <AppShell nav={nav} user={{ name: profile.fullName, email: profile.email }} roleLabel={profile.role === "admin" ? "Administración" : "Autora de contenidos"} signOut={signOut}>
      {children}
    </AppShell>
  );
}

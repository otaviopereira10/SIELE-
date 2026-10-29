import { AppShell, type NavItem } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  const nav: NavItem[] = [
    { href: "/profesora", label: "Inicio", icon: "home", exact: true },
    { href: "/profesora/correcciones", label: "Correcciones", icon: "grading" },
    { href: "/profesora/clases", label: "Clases y alumnos", icon: "classes" },
    { href: "/profesora/asignaciones", label: "Asignar simulacros", icon: "assign" },
    { href: "/profesora/invitaciones", label: "Invitaciones", icon: "invitations" },
    { href: "/profesora/manual", label: "Manual de evaluación", icon: "manual" },
  ];
  if (profile.role === "admin" || profile.canAuthor) nav.push({ href: "/admin/simulacros", label: "Banco de simulacros", icon: "bank" });
  if (profile.role === "admin") nav.push({ href: "/admin", label: "Administración", icon: "users", exact: true });
  return (
    <AppShell nav={nav} user={{ name: profile.fullName, email: profile.email }} roleLabel={profile.role === "admin" ? "Administración" : "Profesora"} signOut={signOut}>
      {children}
    </AppShell>
  );
}

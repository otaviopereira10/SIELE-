import { AppShell, type NavItem } from "@/components/app-shell";
import { requireRole } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";

const NAV: NavItem[] = [
  { href: "/estudiante", label: "Inicio", icon: "home", exact: true },
  { href: "/estudiante/progreso", label: "Mi progreso", icon: "results" },
  { href: "/estudiante/plan", label: "Plan de estudio", icon: "plan" },
  { href: "/estudiante/refuerzo", label: "Refuerzo", icon: "practice" },
  { href: "/estudiante/perfil", label: "Perfil", icon: "profile" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("student");
  return (
    <AppShell nav={NAV} user={{ name: profile.fullName, email: profile.email }} roleLabel="Estudiante" signOut={signOut}>
      {children}
    </AppShell>
  );
}

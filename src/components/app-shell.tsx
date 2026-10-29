"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileStack,
  GraduationCap,
  Home,
  ImageIcon,
  KeyRound,
  LibraryBig,
  LogOut,
  Menu,
  ScrollText,
  Scale,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/utils";

const ICONS = {
  home: Home,
  exams: ClipboardList,
  results: BarChart3,
  plan: CalendarCheck,
  practice: Sparkles,
  profile: UserRound,
  grading: ClipboardCheck,
  classes: GraduationCap,
  students: Users,
  invitations: KeyRound,
  manual: BookOpen,
  bank: FileStack,
  media: ImageIcon,
  rubrics: Scale,
  sources: LibraryBig,
  audit: ScrollText,
  data: Database,
  users: ShieldCheck,
  assign: BookOpenCheck,
} as const;

export type NavIcon = keyof typeof ICONS;
export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  exact?: boolean;
}

export function AppShell({
  nav,
  user,
  roleLabel,
  signOut,
  children,
}: {
  nav: NavItem[];
  user: { name: string; email: string };
  roleLabel: string;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav aria-label="Navegación principal" className="space-y-1">
      {nav.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] transition-colors",
              active ? "bg-brand text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="border-t border-line pt-4">
      <p className="truncate text-sm font-medium text-ink">{user.name || user.email}</p>
      <p className="truncate text-xs text-ink-3">
        {roleLabel} · {user.email}
      </p>
      <form action={signOut} className="mt-3">
        <button type="submit" className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
          <LogOut className="size-4" aria-hidden /> Cerrar sesión
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      {/* barra superior (móvil e iPad vertical) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo compact />
        <span className="text-sm font-medium text-ink-2">{roleLabel}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex size-11 items-center justify-center rounded-lg border border-line"
          aria-label="Abrir menú"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-surface p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-lg" aria-label="Cerrar menú">
                <X className="size-5" />
              </button>
            </div>
            {links}
            {account}
          </div>
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-4 py-5 lg:flex">
        <Logo />
        <p className="-mt-3 rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-ink-2">{roleLabel}</p>
        <div className="flex-1">{links}</div>
        {account}
      </aside>

      <main id="contenido" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

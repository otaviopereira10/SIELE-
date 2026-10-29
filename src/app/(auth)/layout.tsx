import { IndependenceNotice, Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Logo />
      </header>
      <main id="contenido" className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
        <IndependenceNotice />
      </footer>
    </div>
  );
}

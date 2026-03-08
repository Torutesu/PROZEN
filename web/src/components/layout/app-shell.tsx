"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, SignInButton, SignUpButton, Show } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  exact?: boolean;
}

interface AppShellProps {
  children: React.ReactNode;
  nav?: NavItem[];
  title?: string;
}

export function AppShell({ children, nav = [], title }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/workspaces" className="font-bold text-primary text-lg tracking-tight">
            PROZEN
          </Link>

          {nav.length > 0 && (
            <nav className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none min-w-0">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0",
                    pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/"))
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {title && (
          <h1 className="text-2xl font-bold tracking-tight mb-6">{title}</h1>
        )}
        {children}
      </main>
    </div>
  );
}

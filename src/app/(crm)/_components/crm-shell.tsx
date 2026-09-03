"use client";

import { useEffect, useRef, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LayoutDashboard, Menu, PackageCheck, ShieldCheck, Tags, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Дашборд", description: "Аналитика", icon: LayoutDashboard },
  { href: "/orders", label: "Заказы и заявки", description: "Работа менеджера", icon: PackageCheck },
  { href: "/clients", label: "Клиентская база", description: "История обращений", icon: Users },
  { href: "/catalog", label: "Каталог и цены", description: "Внутренний учёт", icon: Tags },
];

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const navigationAvailable = desktop || open;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncViewport = () => setDesktop(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!open || desktop) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      menuButtonRef.current?.focus();
    };
  }, [desktop, open]);

  function trapMobileFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (desktop || event.key !== "Tab") return;
    const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[2px] lg:hidden"
          aria-label="Закрыть навигацию"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        ref={sidebarRef}
        inert={!navigationAvailable}
        aria-hidden={navigationAvailable ? undefined : true}
        onKeyDown={trapMobileFocus}
        className={cn(
          "crm-sidebar fixed inset-y-0 left-0 z-50 flex w-[17.5rem] -translate-x-full flex-col border-white/10 border-r shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:shadow-none",
          open && "translate-x-0",
        )}
      >
        <div className="flex h-20 items-center gap-3 border-white/10 border-b px-5">
          <div className="flex size-11 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white shadow-sm">
            <Image
              src="/brand/dr-nona-logo.png"
              alt="Dr. Nona"
              width={42}
              height={42}
              className="h-auto w-10"
              priority
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-xl leading-none tracking-[-0.02em]">Dr. Nona</p>
            <p className="mt-1 font-bold text-[0.7rem] text-cyan-200 uppercase tracking-[0.14em]">CRM Moldova</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="flex size-11 items-center justify-center rounded-lg border border-white/20 bg-white/10 transition-colors hover:bg-white/16 lg:hidden"
            aria-label="Закрыть меню"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Основная навигация CRM">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "group flex min-h-14 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors",
                  active
                    ? "border-white/12 bg-white/14 text-white shadow-sm"
                    : "text-blue-50/80 hover:border-white/8 hover:bg-white/8 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-colors",
                    active ? "bg-cyan-300 text-slate-950" : "bg-white/8 text-cyan-100 group-hover:bg-white/12",
                  )}
                >
                  <Icon className="size-[1.1rem]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-sm">{item.label}</span>
                  <span className={cn("block text-xs", active ? "text-white/72" : "text-blue-100/55")}>
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="m-3 rounded-xl border border-white/12 bg-white/8 p-3.5">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldCheck className="size-4 text-cyan-200" aria-hidden="true" />
            Внутренняя система
          </div>
          <p className="mt-1.5 text-blue-100/65 text-xs leading-5">Доступ только для команды Dr. Nona Moldova.</p>
        </div>
      </aside>

      <div className="crm-workspace min-w-0">
        <header className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between border-b bg-white/92 px-4 backdrop-blur-md md:px-6">
          <div className="flex items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              className="flex size-11 items-center justify-center rounded-lg border bg-white lg:hidden"
              aria-label="Открыть меню"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <div>
              <p className="font-extrabold text-sm tracking-[-0.01em]">Операционная панель</p>
              <p className="mt-0.5 text-muted-foreground text-xs">Единая база заявок и клиентов</p>
            </div>
          </div>
          <span className="hidden items-center gap-2 rounded-full border bg-secondary px-3 py-1.5 font-bold text-secondary-foreground text-xs sm:inline-flex">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Moldova / MDL
          </span>
        </header>
        <main className="min-h-[calc(100dvh-4.5rem)] p-4 md:p-6 xl:p-7">{children}</main>
      </div>
    </div>
  );
}

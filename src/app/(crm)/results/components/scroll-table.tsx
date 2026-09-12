"use client";

import { type ReactNode, useRef } from "react";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ScrollTable({
  label,
  vertical = false,
  children,
}: {
  label: string;
  vertical?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const controls = [
    { id: "left", label: "Прокрутить таблицу влево", icon: ArrowLeft, left: -240, top: 0 },
    { id: "right", label: "Прокрутить таблицу вправо", icon: ArrowRight, left: 240, top: 0 },
    ...(vertical
      ? [
          { id: "up", label: "Прокрутить таблицу вверх", icon: ArrowUp, left: 0, top: -240 },
          { id: "down", label: "Прокрутить таблицу вниз", icon: ArrowDown, left: 0, top: 240 },
        ]
      : []),
  ];
  return (
    <section
      ref={ref}
      aria-label={label}
      className={`max-w-full overflow-auto rounded-lg border ${vertical ? "max-h-[32rem]" : ""}`}
    >
      <div className="sticky top-0 left-0 z-20 flex gap-1 border-b bg-white p-2">
        {controls.map((control) => (
          <Button
            key={control.id}
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label={control.label}
            onClick={() => ref.current?.scrollBy({ left: control.left, top: control.top, behavior: "instant" })}
          >
            <control.icon className="size-4" aria-hidden="true" />
          </Button>
        ))}
      </div>
      {children}
    </section>
  );
}

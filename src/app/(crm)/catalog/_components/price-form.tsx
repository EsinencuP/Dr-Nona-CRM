"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updateProductPrice } from "../../actions";

const initialState = { ok: false, message: "" };

export function PriceForm({ slug, value }: { slug: string; value: number }) {
  const action = updateProductPrice.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="flex min-w-52 items-start gap-2">
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor={`price-${slug}`}>
          Внутренняя цена
        </label>
        <Input
          id={`price-${slug}`}
          name="internalPrice"
          type="number"
          min="0"
          max="1000000"
          step="0.01"
          defaultValue={value || ""}
          placeholder="0.00"
          required
        />
        <p
          className={`mt-1 min-h-4 text-[0.68rem] ${state.ok ? "text-emerald-700" : "text-rose-700"}`}
          aria-live="polite"
        >
          {state.message}
        </p>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "…" : "Сохранить"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updateProductPrice } from "../../actions";

const initialState = { ok: false, message: "" };

export function PriceForm({
  slug,
  retailPrice,
  distributorPrice,
}: {
  slug: string;
  retailPrice: number;
  distributorPrice: number;
}) {
  const action = updateProductPrice.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid min-w-0 gap-2">
      <div className="min-w-0 flex-1">
        <label className="text-muted-foreground text-xs" htmlFor={`price-${slug}`}>
          Утверждённая розница, MDL
        </label>
        <Input
          id={`price-${slug}`}
          name="retailPrice"
          type="number"
          min="0.01"
          max="1000000"
          step="0.01"
          defaultValue={retailPrice || ""}
          placeholder="0.00"
          required
        />
        <label className="text-muted-foreground text-xs" htmlFor={`distributor-${slug}`}>
          Утверждённая закупка, MDL
        </label>
        <Input
          id={`distributor-${slug}`}
          name="distributorPrice"
          type="number"
          min="0.01"
          max="1000000"
          step="0.01"
          defaultValue={distributorPrice || ""}
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

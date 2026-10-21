"use client";

import { useActionState } from "react";

import { ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";

import { moderateReviewAction } from "../actions";

export function ModerationForm({ id, version, status }: { id: string; version: number; status: string }) {
  const [state, action, pending] = useActionState(moderateReviewAction, { message: "" });
  return (
    <form action={action} className="mt-4 space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="status" value="APPROVED" disabled={pending || status === "APPROVED"}>
          <ThumbsUp aria-hidden="true" /> Одобрить и опубликовать
        </Button>
        <Button
          type="submit"
          name="status"
          value="REJECTED"
          variant="outline"
          disabled={pending || status === "REJECTED"}
        >
          <ThumbsDown aria-hidden="true" /> Отклонить
        </Button>
      </div>
      <p role="status" className="text-sm">
        {pending ? "Сохранение…" : state.message}
      </p>
    </form>
  );
}

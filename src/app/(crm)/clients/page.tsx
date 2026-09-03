import { Search } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PageHeader } from "../_components/page-header";
import { getClients } from "../actions";
import { ClientsTable } from "./_components/clients-table";

export const metadata: Metadata = { title: "Клиентская база" };
export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search = "" } = await searchParams;
  const clients = await getClients(search);
  return (
    <>
      <PageHeader
        eyebrow="Единый профиль"
        title="Клиентская база"
        description="Контакты, регион, количество обращений и полная история работы с каждым клиентом."
      >
        <div className="rounded-xl border bg-white px-4 py-2 text-right">
          <p className="text-muted-foreground text-xs">Клиентов</p>
          <p className="font-extrabold text-xl">{clients.length}</p>
        </div>
      </PageHeader>
      <form action="/clients" className="mb-4 flex max-w-xl gap-2 rounded-xl border bg-white p-3">
        <label className="relative min-w-0 flex-1" htmlFor="clients-search">
          <span className="sr-only">Поиск клиента</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="clients-search"
            name="search"
            defaultValue={search}
            placeholder="Имя, телефон или email"
            className="pl-8"
          />
        </label>
        <Button type="submit">Найти</Button>
      </form>
      <ClientsTable clients={clients} />
    </>
  );
}

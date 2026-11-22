import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { SetupBanner } from "@/components/setup-banner";
import { Badge, Card, EmptyState } from "@/components/ui";
import { hasDb } from "@/infrastructure/db/client";
import { container } from "@/infrastructure/container";
import { DraftForm } from "./draft-form";

export default async function ReviewPage() {
  await connection();
  const items = hasDb() ? await loadDrafts() : [];
  return (
    <>
      <PageHeader title="Review queue" description="Nothing goes out until someone here approves it. Facts used in each email are shown on the right." />
      <SetupBanner />
      {items.length === 0 ? (
        <EmptyState title="Nothing to review">Open a good-fit company on the Companies page and click “Write email”.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map(({ msg, view, facts }) => (
            <Card key={msg.id} className="grid gap-4 md:grid-cols-[1fr_320px]">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{view.company.name}</span>
                  <span className="text-sm text-zinc-500">to {view.contact.name}</span>
                  <Badge tone="blue" title="Simulated recipient: no real email is sent">
                    sandbox inbox
                  </Badge>
                  {msg.meta.needsHuman ? <Badge tone="amber">Needs you</Badge> : <Badge tone="green">Passed all rules</Badge>}
                  {msg.meta.editedByHuman && <Badge>Edited</Badge>}
                </div>
                {msg.meta.violations && msg.meta.violations.length > 0 && (
                  <div className="mb-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
                    <p className="font-medium">{msg.meta.reason ?? "Rule problems"}</p>
                    <ul className="list-disc pl-5">
                      {msg.meta.violations.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <DraftForm messageId={msg.id} subject={msg.subject ?? ""} body={msg.body} />
              </div>
              <aside className="rounded-md bg-zinc-50 p-3 text-sm">
                <p className="mb-2 font-medium">Facts behind this email</p>
                {msg.claims.length === 0 && <p className="text-zinc-500">No facts cited.</p>}
                <ul className="flex flex-col gap-3">
                  {msg.claims.map((c) => {
                    const f = facts.find((x) => x.id === c.factId);
                    return (
                      <li key={c.text}>
                        <p className="font-medium">“{c.text}”</p>
                        {f ? (
                          <p className="mt-1 text-zinc-600">
                            Source says: “{f.quote}”{" "}
                            <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                              open ↗
                            </a>
                          </p>
                        ) : (
                          <p className="mt-1 text-red-700">No matching fact: remove this claim.</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </aside>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

async function loadDrafts() {
  const { repo } = container();
  const threads = await repo.listThreads();
  const drafts = threads.flatMap((view) => view.messages.filter((m) => m.status === "draft" && m.direction === "outbound").map((msg) => ({ msg, view })));
  return Promise.all(drafts.map(async (d) => ({ ...d, facts: await repo.listFacts(d.view.company.id) })));
}

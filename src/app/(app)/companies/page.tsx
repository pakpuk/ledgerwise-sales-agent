import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SetupBanner } from "@/components/setup-banner";
import { ScoreBadge } from "@/components/score-badge";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { hasDb } from "@/infrastructure/db/client";
import { container } from "@/infrastructure/container";
import type { CompanyWithQualification } from "@/application/ports";
import type { QualificationReason } from "@/domain/entities";
import { scoreCompany } from "@/app/actions/companies";
import { writeEmail } from "@/app/actions/review";
import { QUALIFIED_THRESHOLD } from "@/domain/rules/scoring";
import { cn } from "@/lib/utils";

const SORTS = { score: "Best fit", name: "Name", newest: "Newest", facts: "Most facts" } as const;
type Sort = keyof typeof SORTS;

const CRITERION_LABEL: Record<QualificationReason["criterion"], string> = {
  us_ecommerce: "US e-commerce brand",
  trigger: "Reason to talk now",
  revenue_range: "Revenue $1M-$10M",
  team_size: "5-50 employees",
  contact_role: "Founder / COO / finance contact",
};

const VERDICT = {
  meets: { label: "Yes", tone: "green" },
  fails: { label: "No", tone: "red" },
  unknown: { label: "Unknown", tone: "default" },
} as const;

function sortCompanies(list: CompanyWithQualification[], sort: Sort) {
  const s = [...list];
  if (sort === "name") return s.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "newest") return s.sort((a, b) => +b.createdAt - +a.createdAt);
  if (sort === "facts") return s.sort((a, b) => b.factCount - a.factCount);
  return s.sort((a, b) => (b.qualification?.score ?? -1) - (a.qualification?.score ?? -1));
}

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const { sort: rawSort, notice } = await searchParams;
  const sort: Sort = typeof rawSort === "string" && rawSort in SORTS ? (rawSort as Sort) : "score";
  const companies = hasDb() ? sortCompanies(await container().repo.listCompanies(), sort) : [];

  return (
    <>
      <PageHeader title="Companies" description="Prospects the agent researched, with a fit score and the source behind every reason." />
      <SetupBanner />
      {typeof notice === "string" && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Needs you: {notice}</div>}
      {companies.length === 0 ? (
        <EmptyState title="No companies yet">
          Add companies to <code>data/seed-companies.json</code> and run <code>npm run research:seed</code>, or run{" "}
          <code>npm run research</code> to discover new ones.
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-500">Sort by</span>
            {(Object.keys(SORTS) as Sort[]).map((s) => (
              <Link
                key={s}
                href={`/companies?sort=${s}`}
                className={cn("rounded-full border px-3 py-1", s === sort ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:bg-zinc-50")}
              >
                {SORTS[s]}
              </Link>
            ))}
            <span className="ml-auto text-zinc-500">{companies.length} companies</span>
          </div>
          <div className="flex flex-col gap-3">
            {companies.map((c) => (
              <CompanyCard key={c.id} c={c} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function CompanyCard({ c }: { c: CompanyWithQualification }) {
  const q = c.qualification;
  return (
    <Card className="p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.name}</span>
              <a href={c.website} target="_blank" rel="noreferrer" className="text-sm text-zinc-500 hover:underline">
                {c.domain}
              </a>
              {c.source === "research" && <Badge tone="blue">Found by agent</Badge>}
            </div>
            {c.trigger && <p className="mt-0.5 truncate text-sm text-zinc-600">Why now: {c.trigger}</p>}
          </div>
          <span className="text-xs text-zinc-500">{c.factCount} sourced facts</span>
          <ScoreBadge score={q?.score ?? null} />
          <span className="text-zinc-400 transition group-open:rotate-90">›</span>
        </summary>
        <div className="border-t border-zinc-100 p-4">
          {q && q.score >= QUALIFIED_THRESHOLD && (
            <form action={writeEmail} className="mb-4">
              <input type="hidden" name="companyId" value={c.id} />
              <Button size="sm">Write email</Button>
              <span className="ml-2 text-xs text-zinc-500">The draft goes to the Review queue; nothing is sent automatically.</span>
            </form>
          )}
          {q ? (
            <ul className="flex flex-col gap-3">
              {q.reasons.map((r) => (
                <li key={r.criterion} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge tone={VERDICT[r.verdict].tone}>{VERDICT[r.verdict].label}</Badge>
                    <span className="font-medium">{CRITERION_LABEL[r.criterion]}</span>
                  </div>
                  <p className="mt-1 text-zinc-700">{r.reason}</p>
                  {r.quote && r.sourceUrl && (
                    <blockquote className="mt-1 border-l-2 border-zinc-300 pl-3 text-zinc-600">
                      “{r.quote}”{" "}
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="whitespace-nowrap text-blue-700 hover:underline">
                        source ↗
                      </a>
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <form action={scoreCompany} className="flex items-center gap-3">
              <input type="hidden" name="companyId" value={c.id} />
              <p className="text-sm text-zinc-600">Not scored yet.</p>
              <Button size="sm" variant="outline">
                Score now
              </Button>
            </form>
          )}
        </div>
      </details>
    </Card>
  );
}

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Review queue" description="Drafts waiting for a human: approve, edit or reject." />
      <EmptyState title="Nothing to review">Drafts appear here after a company is qualified.</EmptyState>
    </>
  );
}

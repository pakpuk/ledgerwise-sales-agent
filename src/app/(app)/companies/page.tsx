import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Companies" description="Researched and qualified prospects, with cited evidence." />
      <EmptyState title="No companies yet">Import a seed list or run npm run research to add companies.</EmptyState>
    </>
  );
}

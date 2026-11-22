import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Calls" description="Booked meetings." />
      <EmptyState title="No calls booked">Meetings booked by the agent or a human appear here.</EmptyState>
    </>
  );
}

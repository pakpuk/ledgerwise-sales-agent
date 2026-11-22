import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Inbox" description="Prospect replies and how the agent routed them." />
      <EmptyState title="No conversations yet">Replies show up here once outreach has been sent.</EmptyState>
    </>
  );
}

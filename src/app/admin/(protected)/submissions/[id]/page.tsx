import { notFound } from "next/navigation";

import { AdminSubmissionDetail } from "@/components/admin/submission-detail";
import { getAdminSubmission } from "@/lib/supabase/admin-submissions";

export default async function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await getAdminSubmission(id);
  if (!submission) notFound();

  return <AdminSubmissionDetail submission={submission} />;
}

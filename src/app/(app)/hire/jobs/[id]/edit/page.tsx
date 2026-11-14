import { JobForm } from "@/features/hire/jobs/components/JobForm";
import { publicJobUrl } from "@/lib/careers-url";
import { getJob } from "@/features/hire/jobs/actions";
import { getDepartments } from "@/features/departments/actions";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHireCompanyAccess } from "@/lib/hire-company-access";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id).catch(() => null);
  if (!job) notFound();
  const session = await getServerSession(authOptions);
  const companySlug = session
    ? (await getHireCompanyAccess(session.user.id, session.user.role)).find(
        (company) => company.companyId === job.company_id,
      )?.slug
    : undefined;
  const departments = await getDepartments().catch(() => []);
  const now = new Date();
  const isPubliclyLive =
    job.status === "open" &&
    (!job.published_at || new Date(job.published_at) <= now) &&
    (!job.closes_at || new Date(job.closes_at) > now);

  return (
    <>
      <SetPageHeader
        title="Edit Job"
        description={job.title}
        icon="solar:case-minimalistic-broken"
        actions={[
          {
            label: "View Job",
            icon: "solar:eye-broken",
            href: `/hire/jobs/${job.id}`,
          },
          ...(isPubliclyLive
            ? [
                {
                  label: "Careers page",
                  icon: "solar:global-broken",
                  href: publicJobUrl(job.slug, companySlug),
                  variant: "primary" as const,
                },
              ]
            : []),
        ]}
      />
      <JobForm job={job} departments={departments} companySlug={companySlug} />
    </>
  );
}

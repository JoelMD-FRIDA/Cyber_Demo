import { SavedDomainCheckPage } from '@/components/domain-check/saved-domain-check-page';

interface ReportPageProps {
  params: Promise<{ id: string }>;
}

export default async function DomainCheckReportPage({ params }: ReportPageProps) {
  const { id } = await params;

  return <SavedDomainCheckPage checkId={id} view="report" />;
}

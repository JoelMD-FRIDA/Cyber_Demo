import { SavedDomainCheckPage } from '@/components/domain-check/saved-domain-check-page';

interface ResultsPageProps {
  params: Promise<{ id: string }>;
}

export default async function DomainCheckResultsPage({ params }: ResultsPageProps) {
  const { id } = await params;

  return <SavedDomainCheckPage checkId={id} view="results" />;
}

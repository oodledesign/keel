import { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { loadPRDPageData } from '../_lib/server/prd-page.loader';
import { PRDDetailView } from './_components/prd-detail-view';

interface PRDPageProps {
  params: Promise<{
    filename: string;
  }>;
}

export async function generateMetadata({
  params,
}: PRDPageProps): Promise<Metadata> {
  const { filename } = await params;

  try {
    const prd = await loadPRDPageData(filename);

    return {
      title: `${prd.introduction.title} - PRD`,
      description: prd.introduction.overview,
    };
  } catch {
    return {
      title: 'PRD Not Found',
    };
  }
}

export default async function PRDPage({ params }: PRDPageProps) {
  const { filename } = await params;

  try {
    const prd = await loadPRDPageData(filename);

    return <PRDDetailView filename={filename} prd={prd} />;
  } catch (error) {
    console.error('Failed to load PRD:', error);
    notFound();
  }
}

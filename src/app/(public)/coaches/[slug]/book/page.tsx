import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCoachForBooking } from './actions';
import { BookingFlow } from '@/components/booking';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCoachForBooking(slug);

  if (!result.success) {
    return {
      title: 'Book a Session | Coaching Platform',
    };
  }

  return {
    title: `Book a Session with ${result.data.name} | Coaching Platform`,
    description: `Schedule a coaching session with ${result.data.name}. Choose from available session types and find a time that works for you.`,
  };
}

export default async function BookingPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getCoachForBooking(slug);

  if (!result.success) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <BookingFlow coach={result.data} slug={slug} />
    </div>
  );
}

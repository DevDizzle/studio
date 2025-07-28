import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | ProfitScout',
  description: 'Your AI-powered investment dashboard.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-background">{children}</div>;
}

import type { Metadata } from 'next';
import { UserNav } from '@/components/auth/user-nav';

export const metadata: Metadata = {
  title: 'Dashboard | ProfitScout',
  description: 'Your AI-powered investment dashboard.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
           <h1 className="text-2xl font-bold font-headline text-primary">ProfitScout</h1>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-1">
              <UserNav />
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

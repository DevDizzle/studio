import { getStocks } from '../actions';
import { DashboardClientPage } from './dashboard-client-page';
import type { Stock } from '@/lib/firebase';

export default async function DashboardPage() {
  const stocks: Stock[] = await getStocks();

  return <DashboardClientPage initialStocks={stocks} />;
}

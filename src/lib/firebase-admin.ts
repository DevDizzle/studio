'use server';

import { initializeApp as initializeAdminApp, getApps as getAdminApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

if (getAdminApps().length === 0) {
  initializeAdminApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const adminDb = getAdminFirestore();

const StockSchema = z.object({
  id: z.string(), // Document ID is the ticker
  company_name: z.string(),
  bundle_gcs_path: z.string(),
});
export type Stock = z.infer<typeof StockSchema>;


// This function now uses the Admin SDK and should only be called from the server (e.g., in a Server Action)
export async function getStocksAdmin(): Promise<Stock[]> {
    const querySnapshot = await adminDb.collection("stocks").get();
    const stocks: Stock[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const stock = {
            id: doc.id,
            company_name: data.company_name,
            bundle_gcs_path: data.bundle_gcs_path,
        };
        const validation = StockSchema.safeParse(stock);
        if (validation.success) {
            stocks.push(validation.data);
        } else {
            console.error("Invalid stock data from Firestore:", validation.error);
        }
    });
    return stocks;
}

/** Convert a gs:// URI into its bucket and object path parts. */
function parseGcsUri(uri: string): { bucket: string; objectPath: string } {
  if (!uri.startsWith('gs://')) {
    throw new Error(`Invalid GCS URI: ${uri}`);
  }
  const [bucket, ...objectPathParts] = uri.substring(5).split('/');
  return { bucket, objectPath: objectPathParts.join('/') };
}

export async function getStockDataBundleAdmin(uri: string): Promise<any> {
    console.log("getStockDataBundleAdmin called with uri: " + uri);
    // Dynamically import to ensure it's only loaded on the server
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const { bucket, objectPath } = parseGcsUri(uri);
    const [contents] = await storage.bucket(bucket).file(objectPath).download();
    return JSON.parse(contents.toString());
}


export async function getRandomStocks(count: number): Promise<Stock[]> {
    const allStocks = await getStocksAdmin();
    
    // Shuffle the array
    for (let i = allStocks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allStocks[i], allStocks[j]] = [allStocks[j], allStocks[i]];
    }

    return allStocks.slice(0, count);
}

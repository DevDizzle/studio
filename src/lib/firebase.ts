// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { z } from 'zod';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

const StockSchema = z.object({
  id: z.string(), // Document ID is the ticker
  company_name: z.string(),
  bundle_gcs_path: z.string(),
});
export type Stock = z.infer<typeof StockSchema>;


export async function getStocks(): Promise<Stock[]> {
    const querySnapshot = await getDocs(collection(db, "stocks"));
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

export async function getRandomStocks(count: number): Promise<Stock[]> {
    const allStocks = await getStocks();
    
    // Shuffle the array
    for (let i = allStocks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allStocks[i], allStocks[j]] = [allStocks[j], allStocks[i]];
    }

    return allStocks.slice(0, count);
}

export async function saveFeedback(originalFeedback: string, summary: string): Promise<void> {
  try {
    await addDoc(collection(db, "feedback"), {
      originalFeedback,
      summary,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error writing feedback to Firestore: ", error);
    throw new Error("Could not save feedback to the database.");
  }
}

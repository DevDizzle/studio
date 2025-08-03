// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, serverTimestamp, increment, addDoc } from "firebase/firestore";
import { getAuth } from 'firebase/auth';
import { initializeApp as initializeAdminApp, getApps as getAdminApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';


// Client-side Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase for the client
export const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
export const auth = getAuth(app);

// Server-side Firebase Admin SDK configuration
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

// User Management
const UserSchema = z.object({
  uid: z.string(),
  email: z.string().email().optional().nullable(),
  displayName: z.string().optional().nullable(),
  isAnonymous: z.boolean(),
  isSubscribed: z.boolean(),
  usageCount: z.number().int().nonnegative(),
  createdAt: z.any(),
  stripeCustomerId: z.string().optional().nullable(),
});
export type DbUser = z.infer<typeof UserSchema>;

export async function getOrCreateUser(
  uid: string,
  isAnonymous: boolean = false,
  displayName?: string,
  email?: string,
  stripeCustomerId?: string
): Promise<DbUser> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const userData = userSnap.data() as DbUser;
    // If user exists but is missing stripeId, update them.
    if (!userData.stripeCustomerId && stripeCustomerId) {
      await setDoc(userRef, { stripeCustomerId }, { merge: true });
      return { ...userData, stripeCustomerId };
    }
    return userData;
  }

  const newUser: DbUser = {
    uid,
    email: email ?? null,
    displayName: displayName ?? null,
    isAnonymous,
    isSubscribed: false,
    usageCount: 0,
    createdAt: serverTimestamp(),
    stripeCustomerId: stripeCustomerId ?? null,
  };

  await setDoc(userRef, newUser);
  return newUser;
}

export async function incrementUserUsage(uid: string) {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { usageCount: increment(1) }, { merge: true });
}

export async function setUserSubscriptionStatus(
  uid: string,
  isSubscribed: boolean
) {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { isSubscribed }, { merge: true });
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<DbUser | null> {
  const usersRef = collection(db, 'users');
  const q = (await getDocs(usersRef)).docs.find(doc => doc.data().stripeCustomerId === stripeCustomerId);
  
  if (q) {
    return q.data() as DbUser;
  }
  return null;
}

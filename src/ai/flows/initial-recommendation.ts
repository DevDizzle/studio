'use server';

/**
 * @fileOverview Provides an initial buy/hold/sell recommendation for a selected stock(s).
 *
 * - getInitialRecommendation - A function that provides the initial stock recommendation.
 * - InitialRecommendationInput - The input type for the getInitialRecommendation function.
 * - InitialRecommendationOutput - The return type for the getInitialRecommendation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage, ref, getBytes } from 'firebase/storage'; // Example imports; adjust as needed

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
const storage = getStorage(app); // Initialize storage here

const InitialRecommendationInputSchema = z.object({
  uris: z
    .array(z.string())
    .min(0)
    .max(10)
    .describe(
      'An array of 0, 1, 2 or up to 10 GCS URIs for stock data bundles. If 0, the AI should pick one.'
    ),
  sector: z.string().optional().describe('The sector or industry to analyze.'),
  ticker: z.string().optional().describe('The stock ticker.'),
  companyName: z.string().optional().describe('The name of the company.'),
});
export type InitialRecommendationInput = z.infer<
  typeof InitialRecommendationInputSchema
>;

const InitialRecommendationOutputSchema = z.object({
  recommendation: z
    .string()
    .describe(
      'The recommendation (BUY, HOLD, or SELL) and a 1-sentence summary.'
    ),
  reasoning: z
    .array(z.string())
    .describe(
      'An array of 3-5 bullet points for the reasoning behind the recommendation.'
    ),
});
export type InitialRecommendationOutput = z.infer<
  typeof InitialRecommendationOutputSchema
>;

export async function getInitialRecommendation(
  input: InitialRecommendationInput
): Promise<InitialRecommendationOutput> {
  if (input.sector) {
    // Handles both sector and industry analysis (placeholder)
    return sectorRecommendationFlow(input);
  } else if (input.uris.length === 0) {
    // AI Top Pick (placeholder)
    return aiTopPickFlow(input);
  } else if (input.uris.length === 1) {
    // Single stock
    return singleStockRecommendationFlow(input);
  } else if (input.uris.length === 2) {
    // Comparing 2 stocks
    return compareTwoStocksRecommendationFlow(input);
  } else if (input.uris.length > 2) {
    // Multi-stock top pick (placeholder)
    return multiStockTopPickFlow(input);
  } else {
    throw new Error('Invalid input configuration');
  }
}

const getStockPrice = ai.defineTool(
  {
    name: 'getStockPrice',
    description: 'Returns the current market value of a stock from its GCS URI.',
    inputSchema: z.object({
      uri: z.string().describe('The GCS URI of the stock data bundle.'),
    }),
    outputSchema: z.number(),
  },
  async (input) => {
    console.log("getStockPrice called with uri: " + input.uri);
    // This can call any typescript function.
    // For now, return a dummy value.  Assume it is the price.
    return Math.random() * 100;
  }
);

const getStockDataBundle = ai.defineTool(
  {
    name: 'getStockDataBundle',
    description: 'Fetches and returns the full JSON content of a stock data bundle from a GCS URI.',
    inputSchema: z.object({
      uri: z.string().describe('The GCS URI of the stock data bundle.'),
    }),
    outputSchema: z.object({}), // Flexible JSON object
  },
  async (input) => {
    console.log("getStockDataBundle called with uri: " + input.uri);
    
    let path = input.uri;
    // The firebase storage SDK doesn't need the 'gs://' prefix.
    // By storing the full path with bucket, we make this more robust.
    if (path.startsWith('gs://')) {
      path = path.substring('gs://'.length);
    }
    
    const fileRef = ref(storage, path);
    const buffer = await getBytes(fileRef);
    const jsonString = new TextDecoder().decode(buffer);
    return JSON.parse(jsonString);
  }
);

// Single Stock Prompt
const SINGLE_STOCK_PROMPT = `You are ProfitScout, a financial-analysis agent issuing concise BUY/HOLD/SELL recommendations for {{ticker}} – {{companyName}}.

Analyze based *strictly* on the provided JSON data bundle. No external calls. Vague statements are unacceptable. Every point must be backed by data from the file.

Your analysis must reference specific numbers and concrete examples whenever possible.
For example:
- “Revenue increased 12% year-over-year”
- “Operating margin expanded from 18% to 22%”
- “RSI is currently 74, indicating the stock may be overbought”

Use the getStockDataBundle tool for the URI: {{uris.[0]}}

Your response MUST be under 750 words and structured as follows:

- **Recommendation**: "BUY/HOLD/SELL - TICKER - Company Name - A 1-sentence summary of the key rationale."
- **Reasoning**: An array of 3-5 bullet points. Each bullet must be data-backed.

End your analysis by inviting the user to ask follow-up questions about specific data sections: "To learn more, ask about: Earnings Call, MD&A, Technicals, Stock Price, Financials, Ratios, and Key Metrics."

Output strictly as JSON: {"recommendation": "...", "reasoning": ["...", "...", ...]}. No other text.
`;

// Compare Two Stocks Prompt
const COMPARE_TWO_STOCKS_PROMPT = `You are a financial advisor providing investment recommendations for two stocks.

First, use the getStockDataBundle tool to fetch the JSON content for each URI: {{uris.[0]}} and {{uris.[1]}}. Analyze only after loading all data.

Each data bundle contains:
- ticker
- company_name
- business_profile
- earnings_call_summary
- sec_mda
- prices
- technicals
- financial_statements
- ratios and/or key_metrics

Your goal is to provide concise BUY/HOLD/SELL recommendations for each stock, with a comparative analysis. You MUST reference specific numbers, metrics, and excerpts from the data in every step and in the final reasoning. No vague statements—e.g., "Revenue for Stock A grew 15% YoY to $2B from financial_statements, outpacing Stock B's 5% growth to $1B."

Use Chain of Thought reasoning: Step-by-step, analyze each key section comparatively, then synthesize.

Step 1: Load and summarize data for both stocks (tickers, company names, key metrics overview with specific extractions).

Step 2: Business Profile & Moat - Compare core business, products, advantages. Quote specifics from each business_profile.

Step 3: Financial Health & Earnings - Compare revenue, EPS, margins, YoY/QoQ trends from financial_statements and earnings_call_summary. Include management tones and catalysts with quotes.

Step 4: Valuation - Compare P/E, P/S, ROE, debt ratios from ratios/key_metrics. Assess premiums/discounts (e.g., "Stock A P/E 20 vs. Stock B 30").

Step 5: Technicals & Price Action - Compare price trends, SMAs, RSI from prices and technicals. Compute recent returns (e.g., "Stock A up 10% vs. Stock B down 2% over 90 days").

Step 6: Risks & Opportunities - Compare risks/drivers with quotes from sec_mda and earnings_call_summary.

Step 7: Synthesize - Based on comparisons, decide BUY/HOLD/SELL for each, with one potentially stronger. Provide a comparative summary sentence.

Structure:
- Recommendation: "BUY/HOLD/SELL for TICKER1 (Company1) vs. BUY/HOLD/SELL for TICKER2 (Company2) - 1-sentence comparative summary."
- Reasoning: 3-5 bullets with comparative, data-backed insights. End with: "To learn more, ask a follow-up question about any of these sections: Business Profile, Earnings Call, MD&A, Technicals, Stock Price, Financials, Ratios, and Key Metrics for either stock."

Keep under 500 words. Use getStockPrice if needed.

Output strictly as JSON: {"recommendation": "BUY/HOLD/SELL for TICKER1 (Company1) vs. BUY/HOLD/SELL for TICKER2 (Company2) - summary sentence", "reasoning": ["bullet point 1", "bullet point 2", ...]}. No other text.`;

// Sector/Industry Placeholder Prompt (simplified)
const SECTOR_PROMPT = `You are a financial advisor providing investment recommendations.

Provide a concise buy/hold/sell recommendation for the sector or industry: {{sector}} based on aggregated data from key stocks or trends.

Structure:
1. Recommendation: "BUY/HOLD/SELL for {{sector}} - 1-sentence summary of key rationale."
2. Reasoning: 3-5 bullet points highlighting impactful factors (e.g., growth, risks). End with: "To learn more, ask a follow-up question about specific stocks or trends in this sector."

Use tools for real-time data if needed. Keep under 500 words.

Output strictly as JSON: {"recommendation": "BUY/HOLD/SELL for SECTOR - summary sentence", "reasoning": ["bullet point 1", "bullet point 2", ...]}. No other text.`;

// AI Top Pick Placeholder Prompt (simplified, for uris.length === 0)
const AI_TOP_PICK_PROMPT = `You are a financial advisor in "AI Top Pick" mode. Pick a single promising stock from a well-known company, provide a concise BUY/HOLD/SELL recommendation based on real-time data.

Structure:
1. Recommendation: "BUY/HOLD/SELL for TICKER (Company) - 1-sentence summary."
2. Reasoning: 3-5 bullets with key factors. End with: "To learn more, ask a follow-up question about this stock's data or analysis."

Use tools for data. Keep under 500 words.

Output strictly as JSON: {"recommendation": "BUY/HOLD/SELL for TICKER (Company Name) - summary sentence", "reasoning": ["bullet point 1", "bullet point 2", ...]}. No other text.`;

// Multi-Stock Top Pick Placeholder Prompt (for uris.length > 2)
const MULTI_STOCK_TOP_PICK_PROMPT = `You are a financial-analysis agent scanning up to 10 JSON bundles to surface the AI Top Pick.

First, use getStockDataBundle for each URI. Analyze strictly from data.

Follow the analysis pipeline from your knowledge (business profile, earnings, MD&A, technicals, valuation), compute composite scores, pick the winner.

Output:
- Recommendation: "BUY/HOLD/SELL for TOP_TICKER (Company) - 1-sentence punchline."
- Reasoning: 3-5 bullets for why #1, plus runner-ups. End with: “Ask for deeper details on any ticker!”

Keep under 350 words.

Output strictly as JSON: {"recommendation": "BUY/HOLD/SELL for TICKER (Company Name) - summary sentence", "reasoning": ["bullet point 1", "bullet point 2", ...]}. Include runner-ups in reasoning. No other text.`;

// Define Prompts and Flows
const singleStockPrompt = ai.definePrompt(
  {
    name: 'singleStockPrompt',
    input: { schema: InitialRecommendationInputSchema },
    output: { schema: InitialRecommendationOutputSchema },
    prompt: SINGLE_STOCK_PROMPT,
    tools: [getStockPrice, getStockDataBundle],
    config: { temperature: 0.7 }
  }
);

const singleStockRecommendationFlow = ai.defineFlow(
  {
    name: 'singleStockRecommendationFlow',
    inputSchema: InitialRecommendationInputSchema,
    outputSchema: InitialRecommendationOutputSchema,
  },
  async (input) => {
    const { output } = await singleStockPrompt(input);
    return output!;
  }
);

const compareTwoStocksPrompt = ai.definePrompt(
  {
    name: 'compareTwoStocksPrompt',
    input: { schema: InitialRecommendationInputSchema },
    output: { schema: InitialRecommendationOutputSchema },
    prompt: COMPARE_TWO_STOCKS_PROMPT,
    tools: [getStockPrice, getStockDataBundle],
    config: { temperature: 0.7 }
  }
);

const compareTwoStocksRecommendationFlow = ai.defineFlow(
  {
    name: 'compareTwoStocksRecommendationFlow',
    inputSchema: InitialRecommendationInputSchema,
    outputSchema: InitialRecommendationOutputSchema,
  },
  async (input) => {
    const { output } = await compareTwoStocksPrompt(input);
    return output!;
  }
);

const sectorPrompt = ai.definePrompt(
  {
    name: 'sectorPrompt',
    input: { schema: InitialRecommendationInputSchema },
    output: { schema: InitialRecommendationOutputSchema },
    prompt: SECTOR_PROMPT,
    tools: [getStockPrice, getStockDataBundle],
    config: { temperature: 0.7 }
  }
);

const sectorRecommendationFlow = ai.defineFlow(
  {
    name: 'sectorRecommendationFlow',
    inputSchema: InitialRecommendationInputSchema,
    outputSchema: InitialRecommendationOutputSchema,
  },
  async (input) => {
    const { output } = await sectorPrompt(input);
    return output!;
  }
);

const aiTopPickPrompt = ai.definePrompt(
  {
    name: 'aiTopPickPrompt',
    input: { schema: InitialRecommendationInputSchema },
    output: { schema: InitialRecommendationOutputSchema },
    prompt: AI_TOP_PICK_PROMPT,
    tools: [getStockPrice, getStockDataBundle],
    config: { temperature: 0.7 }
  }
);

const aiTopPickFlow = ai.defineFlow(
  {
    name: 'aiTopPickFlow',
    inputSchema: InitialRecommendationInputSchema,
    outputSchema: InitialRecommendationOutputSchema,
  },
  async (input) => {
    const { output } = await aiTopPickPrompt(input);
    return output!;
  }
);

const multiStockTopPickPrompt = ai.definePrompt(
  {
    name: 'multiStockTopPickPrompt',
    input: { schema: InitialRecommendationInputSchema },
    output: { schema: InitialRecommendationOutputSchema },
    prompt: MULTI_STOCK_TOP_PICK_PROMPT,
    tools: [getStockPrice, getStockDataBundle],
    config: { temperature: 0.7 }
  }
);

const multiStockTopPickFlow = ai.defineFlow(
  {
    name: 'multiStockTopPickFlow',
    inputSchema: InitialRecommendationInputSchema,
    outputSchema: InitialRecommendationOutputSchema,
  },
  async (input) => {
    const { output } = await multiStockTopPickPrompt(input);
    return output!;
  }
);

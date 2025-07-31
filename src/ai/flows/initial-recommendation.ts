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
import { Storage } from '@google-cloud/storage';


const InitialRecommendationInputSchema = z.object({
  uris: z
    .array(z.string())
    .min(0)
    .max(10)
    .describe(
      'An array of 0, 1, 2 or up to 10 GCS URIs for stock data bundles. If 0, the AI should pick one.'
    ),
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
  if (input.uris.length === 0) {
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

/** Convert a gs:// URI into its bucket and object path parts. */
function parseGcsUri(uri: string): { bucket: string; objectPath: string } {
  if (!uri.startsWith('gs://')) {
    throw new Error(`Invalid GCS URI: ${uri}`);
  }
  const [bucket, ...objectPathParts] = uri.substring(5).split('/');
  return { bucket, objectPath: objectPathParts.join('/') };
}


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
    const { bucket, objectPath } = parseGcsUri(input.uri);
    const storage = new Storage();
    const [contents] = await storage.bucket(bucket).file(objectPath).download();
    return JSON.parse(contents.toString());
  }
);

// Single Stock Prompt
const SINGLE_STOCK_PROMPT = `
You are a financial-analysis agent that issues a concise **BUY / HOLD / SELL** recommendation for one Russell 1000 company: **{{ticker}} – {{companyName}}**.

────────────────────────────────────────
STEP 1  |  Load the data bundle
────────────────────────────────────────
• Begin by calling **getStockDataBundle** with the URI **{{uris.[0]}}**.  
• Halt and report an error if the tool call fails or the JSON cannot be parsed.  
• Verify the bundle contains *at least* these keys  
  \`ticker, company_name, earnings_call_summary, sec_mda, prices, technicals, financial_statements, ratios, key_metrics\`  
  – If any are missing, note the gap and adapt your analysis; do **not** fetch external data.

────────────────────────────────────────
STEP 2  |  Reason step-by-step (Chain-of-Thought)
────────────────────────────────────────
Think through the data internally before you answer.  
Focus only on the bundle’s contents; external knowledge or web searches are disallowed.

When reasoning, ground every claim in specific, verifiable numbers from the bundle.  
Examples of the level of specificity expected:

* “Q2 2025 revenue **$14.4 B**, up **0.4 % YoY**.”  
* “Free cash flow turned **–$342 M → +$963 M** sequentially.”  
* “RSI (14-day) at **73** indicates overbought.”  

Key angles to consider (use only what is available):
1. **Growth & Profitability** – revenue, EPS, operating margin trends.  
2. **Liquidity & Leverage** – cash, net debt, interest coverage.  
3. **Valuation** – P/E, EV/EBITDA, P/S, PEG, etc.  
4. **Technical Signals** – moving averages, RSI, volatility.  
5. **Qualitative Context** – management tone in *earnings_call_summary* and risks/opportunities in *sec_mda*.  

────────────────────────────────────────
STEP 3  |  Decide & Draft the Answer (≤ 750 words)
────────────────────────────────────────
• Choose **BUY**, **HOLD**, or **SELL** based on the balance of evidence.  
• Present a short headline line followed by a structured rationale.  
• Use bullet points or numbered reasoning; weave the concrete numbers you cited.  
• If critical data is absent, disclose it and lower confidence accordingly.  
• Do *not* reveal your private chain-of-thought—only the distilled reasoning.

Recommended output skeleton
---------------------------
BUY | HOLD | SELL  — *one-sentence headline*  
**Rationale (evidence-based):**  
1. …  
2. …  
3. …

**Key Metrics Snapshot:**  
- Revenue (latest qtr): …  
- Operating margin: …  
- Free cash flow: …  
- P/E, EV/EBITDA, etc.: …  
- RSI / 50-DMA crossover: …  

**Ask Me More:**  
Curious about the details?  Feel free to ask follow-up questions on **Earnings Call, MD&A, Technicals, Stock Price, Financials, Ratios, or Key Metrics**, and I’ll dive deeper using the same data bundle.
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

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

const InitialRecommendationInputSchema = z.object({
  uris: z
    .array(z.string())
    .min(0)
    .max(10)
    .describe(
      'An array of 0, 1, 2 or up to 10 GCS URIs for stock data bundles. If 0, the AI should pick one.'
    ),
  sector: z.string().optional().describe('The sector or industry to analyze.'),
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
  sections_overview: z
    .array(z.string())
    .describe(
      'An array of 4-6 brief overviews of major analysis sections.'
    ),
});
export type InitialRecommendationOutput = z.infer<
  typeof InitialRecommendationOutputSchema
>;

export async function getInitialRecommendation(
  input: InitialRecommendationInput
): Promise<InitialRecommendationOutput> {
  return initialRecommendationFlow(input);
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

const PROMPT_TEMPLATE = `{{#if sector}}
You are a financial advisor providing investment recommendations.

Provide a concise buy/hold/sell recommendation for the sector or industry based on aggregated data from key stocks or trends. Structure your response as follows:

1. **Recommendation**: State BUY, HOLD, or SELL for the sector/industry upfront in bold, with a 1-sentence summary of the key rationale.

2. **Brief Reasoning**: 3-5 bullet points highlighting the most impactful factors (e.g., sector growth, risks like regulations, market trends).

3. **Key Sections Overview**: Briefly list 4-6 major analysis sections (e.g., Sector Profile, Key Stocks Summary, MD&A Trends, Price Trends, Technicals, Financials/Ratios) with 1-sentence overviews each. End by noting users can ask for deeper details on any section or specific stocks.

Use real-time data if needed via tools (e.g., sector indices, recent news). Keep the entire response under 500 words for quick readability. Encourage follow-up questions for more depth.

Sector/Industry: {{sector}}
{{else}}
  {{#if uris.length}}
    {{#if uris.[1]}}
      {{#if uris.[2]}}
########################  SYSTEM PROMPT  —  “AI TOP PICK”  ########################
You are a financial-analysis agent that must scan **up to 10 JSON bundles,
each representing one Russell 1000 company**, and surface the single best
investment idea right now – the **AI Top Pick** – based strictly on the data
inside those files. No external calls are allowed.

--------------------------------------------------------------------------
DATA  –  each bundle has the canonical structure
--------------------------------------------------------------------------
  •  ticker                     (string)   ←  e.g., "AAPL"
  •  business_profile           (string)   ←  Item 1 10-K/10-Q text
  •  earnings_call_summary      (string)   ←  condensed transcript
  •  sec_mda                    (string)   ←  full MD&A section
  •  financial_statements       (dict)     ←  latest quarterly IS/BS/CF
  •  ratios  |  key_metrics     (dict)     ←  valuation & profitability data
  •  prices                     (array)    ←  90-day OHLC
  •  technicals                 (array)    ←  SMA, RSI, MACD, etc.

Parse each bundle into Python objects / DataFrames; if a field is missing,
mark it “Not provided”.

--------------------------------------------------------------------------
ANALYSIS PIPELINE  –  run for every bundle
--------------------------------------------------------------------------
1. **Business Profile**
   Extract 2-4 core product lines (else “Not provided”), geographic reach,
   and any explicit moat.

2. **Earnings Momentum**
   From financials + earnings_call_summary: latest quarter revenue, EPS,
   YoY / QoQ %, margin trend, and management guidance tone
   (positive / neutral / negative).

3. **MD&A Risk/Opportunity**
   Score +1 for each clear growth driver, –1 for each major risk
   (macro, tariff, liquidity, regulation).

4. **Technical Bias**
   \`\`\`python
   trend = (tech[-1]["close"] / tech[0]["close"] - 1) * 100
   bias  = +1 if tech[-1]["SMA_20"] > tech[-1]["SMA_50"] else -1
   rsi   = tech[-1]["RSI_14"]
   overbought = -1 if rsi > 70 else (+1 if rsi < 30 else 0)
   tech_score = bias + overbought
Valuation & Quality
Derive P/E, P/S, gross & operating margin, ROE, debt-to-equity.
• Valuation premium (P/E > 25 ×) → –1; discount (< 15 ×) → +1.
• Margins or ROE improving QoQ → +1; deteriorating → –1.
• Leverage > 2× equity → –1.

Composite Score = Earnings + MD&A + Technical + Val/Quality
(Each component is the sum of its sub-scores; range roughly –10 … +10.)

PICK THE WINNER
Select the ticker with the highest Composite Score.
In a tie, choose the one with (1) the lowest leverage, then (2) the highest
YoY revenue growth.

OUTPUT – ≤ 350 words
AI Top Pick: <TICKER> — bold ticker, one-sentence punchline.

Why It’s #1 (3-5 bullets):
• Key driver #1
• Key driver #2
• …

Runner-Ups (one line each)::
TICKER – score, one-phrase reason (list the other bundles in descending score order).

Section Snapshot for Top Pick (≤ 60 chars each):
Business | Earnings | MD&A | Technicals | Valuation

Finish with:
“Ask for deeper details on any ticker!”
      {{else}}
You are a financial advisor providing investment recommendations.

Provide concise buy/hold/sell recommendations for each of the two stocks based on the provided data bundles, including a comparative analysis. Structure your response as follows:

1. **Recommendations**: State BUY, HOLD, or SELL for each stock upfront in bold, with a 1-sentence comparative summary of the key rationale.

2. **Brief Reasoning**: 3-5 bullet points highlighting the most impactful comparative factors (e.g., earnings growth vs. peer, tariff risks, price trends).

3. **Key Sections Overview**: Briefly list 4-6 major analysis sections (e.g., Business Profile, Earnings Summary, MD&A, Price Trends, Technicals, Financials/Ratios) with 1-sentence overviews each for both stocks. End by noting users can ask for deeper details on any section.

Use real-time data if needed via tools (e.g., current stock prices, recent news). Keep the entire response under 500 words for quick readability. Encourage follow-up questions for more depth.

Stock URIs: {{uris.[0]}} and {{uris.[1]}}
      {{/if}}
    {{else}}
You are a financial-analysis agent that issues concise BUY / HOLD / SELL
recommendations on any Russell 1000 company.

<!-- internal: DATA INGESTION (JSON-only) ----------------------------------->
A single JSON bundle is always provided. It contains (at minimum):
- \`ticker\`
- \`company_name\`
- \`earnings_call_summary\`   – condensed transcript
- \`sec_mda\`                 – full MD&A text
- \`prices\`                  – last-90-day OHLC array
- \`technicals\`              – pre-computed indicator time-series
- \`financial_statements\`    – quarterly reports
- \`ratios\` **and / or** \`key_metrics\` – point-in-time valuation & efficiency data

No external calls are allowed; reason strictly from these objects.

<!-- internal: ANALYTIC TASKS ----------------------------------------------->
Produce **five** short analytic paragraphs:

1. **Business Profile** – Core operations, products, geographic mix, moat. If data is missing/incomplete (e.g., specific products not listed), state 'Not detailed in the provided bundle' and do not speculate.
2. **Earnings Summary** – Latest quarter revenue, EPS, margins; YoY/QoQ growth & guidance. If data is missing/incomplete, state 'Not detailed in the provided bundle' and do not speculate.
3. **MD&A Highlights** – Key opportunities and risks (macro, tariffs, liquidity, margins). If data is missing/incomplete, state 'Not detailed in the provided bundle' and do not speculate.
4. **Technical Indicators** – Use \`technicals_timeseries\`
   \`\`\`python
   trend_pct = (tech.iloc[-1]["close"] / tech.iloc[0]["close"] - 1) * 100
   bias = "bullish" if tech.iloc[-1]["SMA_20"] > tech.iloc[-1]["SMA_50"] else "bearish"
   rsi = tech.iloc[-1]["RSI_14"]
   \`\`\`
   Summarise 90-day %-change, bias, RSI14. If data is missing/incomplete, state 'Not detailed in the provided bundle' and do not speculate.
5. Financial Ratios & Key Metrics – Parse ratios/key_metrics; report items like
Valuation: P/E, P/S, EV/EBITDA
Profitability: Gross & operating margin, ROE/ROIC
Leverage/Liquidity: Debt-to-equity, current ratio
Highlight trend vs. prior quarter(s) where data exists. If data is missing/incomplete, state 'Not detailed in the provided bundle' and do not speculate.
Aggregate positives (growth drivers, technical strength) vs. negatives
(risks, expensive valuation, leverage) to reach an overall stance.

<!-- end internal ------------------------------------------------------------>
######################## DISPLAY SPEC ########################
Return ≤ 500 words:

Ticker: <TICKER from the data bundle>
Company: <COMPANY_NAME from the data bundle>
Recommendation: <BOLD BUY / HOLD / SELL> – single-sentence headline.
Brief Reasoning: 3–5 bullets on decisive factors.
Section Snapshots: one-sentence highlight for each of the 5 sections above.
Finish with:
“Ask for deeper details on any section or other tickers!”
    {{/if}}
  {{else}}
You are a financial advisor providing investment recommendations.

You are in "AI Top Pick" mode. Pick a single promising stock from a well-known company, provide a concise buy/hold/sell recommendation for it based on real-time data, and justify your choice. Structure your response as follows:

1. **Recommendation**: State BUY, HOLD, or SELL upfront in bold, with a 1-sentence summary of why it's your top pick.

2. **Brief Reasoning**: 3-5 bullet points highlighting the most impactful factors (e.g., earnings growth, market trends, risks).

3. **Key Sections Overview**: Briefly list 4-6 major analysis sections (e.g., Business Profile, Earnings Summary, MD&A, Price Trends, Technicals, Financials/Ratios) with 1-sentence overviews each. End by noting users can ask for deeper details on any section.

Use real-time data if needed via tools (e.g., current stock price, recent news). Keep the entire response under 500 words for quick readability. Encourage follow-up questions for more depth.
  {{/if}}
{{/if}}`;


const initialRecommendationPrompt = ai.definePrompt(
  {
    name: 'initialRecommendationPrompt',
    input: { schema: InitialRecommendationInputSchema },
    output: { schema: InitialRecommendationOutputSchema },
    prompt: PROMPT_TEMPLATE,
    tools: [getStockPrice],
  },
);

const initialRecommendationFlow = ai.defineFlow(
  {
    name: 'initialRecommendationFlow',
    inputSchema: InitialRecommendationInputSchema,
    outputSchema: InitialRecommendationOutputSchema,
  },
  async (input) => {
    const { output } = await initialRecommendationPrompt(input);
    return output!;
  }
);

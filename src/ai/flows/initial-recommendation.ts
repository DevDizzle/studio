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
    .max(2)
    .describe(
      'An array of 0, 1 or 2 GCS URIs for stock data bundles. If 0, the AI should pick one.'
    ),
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

const PROMPT_TEMPLATE = `{{#if uris.length}}
  {{#if uris.[1]}}
You are a financial advisor providing investment recommendations.

Provide concise buy/hold/sell recommendations for each of the two stocks based on the provided data bundles, including a comparative analysis. Structure your response as follows:

1. **Recommendations**: State BUY, HOLD, or SELL for each stock upfront in bold, with a 1-sentence comparative summary of the key rationale.

2. **Brief Reasoning**: 3-5 bullet points highlighting the most impactful comparative factors (e.g., earnings growth vs. peer, tariff risks, price trends).

3. **Key Sections Overview**: Briefly list 4-6 major analysis sections (e.g., Business Profile, Earnings Summary, MD&A, Price Trends, Technicals, Financials/Ratios) with 1-sentence overviews each for both stocks. End by noting users can ask for deeper details on any section.

Use real-time data if needed via tools (e.g., current stock prices, recent news). Keep the entire response under 500 words for quick readability. Encourage follow-up questions for more depth.

Stock URIs: {{uris.[0]}} and {{uris.[1]}}
  {{else}}
You are a financial advisor providing investment recommendations.

Provide a concise buy/hold/sell recommendation for the stock based on the provided data bundle. Structure your response as follows:

1. **Recommendation**: State BUY, HOLD, or SELL upfront in bold, with a 1-sentence summary of the key rationale.

2. **Brief Reasoning**: 3-5 bullet points highlighting the most impactful factors (e.g., earnings growth, risks like tariffs, price trends).

3. **Key Sections Overview**: Briefly list 4-6 major analysis sections (e.g., Business Profile, Earnings Summary, MD&A, Price Trends, Technicals, Financials/Ratios) with 1-sentence overviews each. End by noting users can ask for deeper details on any section.

Use real-time data if needed via tools (e.g., current stock price, recent news). Keep the entire response under 500 words for quick readability. Encourage follow-up questions for more depth.

Stock URI: {{uris.[0]}}
  {{/if}}
{{else}}
  You are in "AI Top Pick" mode. Pick a single promising stock from a well-known company, provide a recommendation for it, and justify your choice.
{{/if}}`;

const initialRecommendationPrompt = ai.definePrompt({
  name: 'initialRecommendationPrompt',
  input: {schema: InitialRecommendationInputSchema},
  output: {schema: InitialRecommendationOutputSchema},
  tools: [getStockPrice],
  prompt: PROMPT_TEMPLATE,
});

const initialRecommendationFlow = ai.defineFlow(
  {
    name: 'initialRecommendationFlow',
    inputSchema: InitialRecommendationInputSchema,
    outputSchema: InitialRecommendationOutputSchema,
  },
  async (input) => {
    const {output} = await initialRecommendationPrompt(input);
    return output!;
  }
);

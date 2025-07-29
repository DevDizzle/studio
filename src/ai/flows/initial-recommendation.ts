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
    .describe('An array of 0, 1 or 2 GCS URIs for stock data bundles. If 0, the AI should pick one.'),
});
export type InitialRecommendationInput = z.infer<
  typeof InitialRecommendationInputSchema
>;

const InitialRecommendationOutputSchema = z.object({
  recommendation: z
    .string()
    .describe(
      'A buy/hold/sell recommendation for the selected stock(s), along with a brief justification.'
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

const getStockPrice = ai.defineTool({
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
});

const initialRecommendationPrompt = ai.definePrompt({
  name: 'initialRecommendationPrompt',
  input: {schema: InitialRecommendationInputSchema},
  output: {schema: InitialRecommendationOutputSchema},
  tools: [getStockPrice],
  prompt: `You are a financial advisor providing investment recommendations.

  Provide a buy/hold/sell recommendation for the following stock(s) based on real-time data. Use the getStockPrice tool to get the current price of the stock. Provide a brief justification for your recommendation.

  {% if uris.length == 0 %}
  Pick a single promising stock and provide a recommendation for it.
  {% elif uris.length == 1 %}
  Stock URI: {{uris.[0]}}
  {% else %}
  Stock URIs: {{#each uris}}{{{this}}} {{/each}}
  {% endif %}`,
});

const initialRecommendationFlow = ai.defineFlow(
  {
    name: 'initialRecommendationFlow',
    inputSchema: InitialRecommendationInputSchema,
    outputSchema: InitialRecommendationOutputSchema,
  },
  async input => {
    const {output} = await initialRecommendationPrompt(input);
    return output!;
  }
);

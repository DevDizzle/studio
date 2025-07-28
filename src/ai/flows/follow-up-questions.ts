'use server';

/**
 * @fileOverview An AI agent to answer follow-up questions about stock recommendations.
 *
 * - answerFollowUpQuestion - A function that answers follow-up questions related to stock recommendations.
 * - FollowUpQuestionInput - The input type for the answerFollowUpQuestion function.
 * - FollowUpQuestionOutput - The return type for the answerFollowUpQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FollowUpQuestionInputSchema = z.object({
  question: z.string().describe('The follow-up question to be answered.'),
  ticker1: z.string().describe('The ticker symbol of the first stock.'),
  ticker2: z.string().optional().describe('The ticker symbol of the second stock, if comparing two stocks.'),
  initialRecommendation: z.string().describe('The initial stock recommendation provided to the user.'),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().describe('The history of the conversation between the user and the assistant.'),
});
export type FollowUpQuestionInput = z.infer<typeof FollowUpQuestionInputSchema>;

const FollowUpQuestionOutputSchema = z.object({
  answer: z.string().describe('The answer to the follow-up question, grounded in the initial stock recommendation and real-time data.'),
});
export type FollowUpQuestionOutput = z.infer<typeof FollowUpQuestionOutputSchema>;

export async function answerFollowUpQuestion(input: FollowUpQuestionInput): Promise<FollowUpQuestionOutput> {
  return answerFollowUpQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'followUpQuestionPrompt',
  input: {schema: FollowUpQuestionInputSchema},
  output: {schema: FollowUpQuestionOutputSchema},
  prompt: `You are an AI assistant providing financial advice. A user has asked a follow-up question about an initial stock recommendation. Use the initial recommendation and any available information to provide a helpful and informative answer.

Initial Recommendation: {{{initialRecommendation}}}

User Follow-up Question: {{{question}}}

{% if chatHistory %}
  Chat History:
  {% for message in chatHistory %}
    {{message.role}}: {{message.content}}
  {% endfor %}
{% endif %}

Ticker 1: {{{ticker1}}}
{% if ticker2 %}Ticker 2: {{{ticker2}}}{% endif %}

Answer:`, // Removed the explicit output format request, relying on the schema description.
});

const answerFollowUpQuestionFlow = ai.defineFlow(
  {
    name: 'answerFollowUpQuestionFlow',
    inputSchema: FollowUpQuestionInputSchema,
    outputSchema: FollowUpQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

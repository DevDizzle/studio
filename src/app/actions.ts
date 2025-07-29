'use server';

import { 
  getInitialRecommendation,
  type InitialRecommendationInput,
  type InitialRecommendationOutput
} from '@/ai/flows/initial-recommendation';
import {
  answerFollowUpQuestion,
  type FollowUpQuestionInput,
  type FollowUpQuestionOutput,
} from '@/ai/flows/follow-up-questions';
import {
  summarizeFeedback,
  type SummarizeFeedbackInput,
  type SummarizeFeedbackOutput,
} from '@/ai/flows/feedback-summarization';

export async function handleGetRecommendation(uris: string[]): Promise<InitialRecommendationOutput> {
  const input: InitialRecommendationInput = { uris };
  const result: any = await getInitialRecommendation(input);
  
  // Combine the structured response into a single string for display
  const recommendationText = `
    **Recommendation:** ${result.recommendation}

    **Reasoning:**
    ${result.reasoning.map((item: string) => `- ${item}`).join('\n')}

    **Key Sections Overview:**
    ${result.sections_overview.map((item: string) => `- ${item}`).join('\n')}
  `;
  
  return { recommendation: recommendationText.trim(), reasoning: [], sections_overview: [] };
}

export async function handleFollowUp(data: {
  question: string;
  tickers: string[];
  initialRecommendation: string;
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
}): Promise<FollowUpQuestionOutput> {
  const input: FollowUpQuestionInput = {
    question: data.question,
    ticker1: data.tickers[0],
    ticker2: data.tickers[1] || undefined,
    initialRecommendation: data.initialRecommendation,
    chatHistory: data.chatHistory,
  };
  return await answerFollowUpQuestion(input);
}

export async function handleFeedback(feedbackText: string): Promise<SummarizeFeedbackOutput> {
  const input: SummarizeFeedbackInput = { feedbackText };
  return await summarizeFeedback(input);
}

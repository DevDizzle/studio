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

export async function handleGetRecommendation(tickers: string[]): Promise<InitialRecommendationOutput> {
  const input: InitialRecommendationInput = { tickers };
  return await getInitialRecommendation(input);
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

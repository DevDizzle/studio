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
} from '@/ai/flows/feedback-summarization';
import { saveFeedback, getOrCreateUser, incrementUserUsage as incrementUserUsageDb } from '@/lib/firebase';

export async function handleGetRecommendation(uid: string, input: InitialRecommendationInput): Promise<InitialRecommendationOutput | { error: string; required: 'subscription' }> {
  const user = await getOrCreateUser(uid);
  if (user.usageCount >= 5 && !user.isSubscribed) {
    return { error: 'Usage limit reached', required: 'subscription' };
  }
  await incrementUserUsageDb(uid);
  const result: InitialRecommendationOutput = await getInitialRecommendation(input);
  return result;
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

export async function handleFeedback(feedbackText: string): Promise<void> {
  const input: SummarizeFeedbackInput = { feedbackText };
  const summaryOutput = await summarizeFeedback(input);
  await saveFeedback(feedbackText, summaryOutput.summary);
}

export async function checkAndIncrementUsage(uid: string): Promise<{ success: boolean; usageCount: number; isSubscribed: boolean }> {
  const user = await getOrCreateUser(uid);
  if (user.usageCount >= 5 && !user.isSubscribed) {
    return { success: false, usageCount: user.usageCount, isSubscribed: user.isSubscribed };
  }
  await incrementUserUsageDb(uid);
  const updatedUser = await getOrCreateUser(uid); // Re-fetch to get the latest count
  return { success: true, usageCount: updatedUser.usageCount, isSubscribed: updatedUser.isSubscribed };
}
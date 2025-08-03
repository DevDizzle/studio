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
import { saveFeedback, getOrCreateUser, incrementUserUsage as incrementUserUsageDb, type Stock } from '@/lib/firebase';
import { getStocksAdmin } from '@/lib/firebase-admin';
import { createStripeCheckoutSession } from '@/lib/stripe';
import { headers } from 'next/headers';

export async function getStocks(): Promise<Stock[]> {
    return getStocksAdmin();
}

export async function handleGetRecommendation(uid: string, input: InitialRecommendationInput): Promise<InitialRecommendationOutput | { error: string; required?: 'subscription' | 'auth' }> {
  const user = await getOrCreateUser(uid);
  if (user.usageCount >= 5 && !user.isSubscribed) {
    return { error: 'Usage limit reached', required: 'subscription' };
  }
  // Don't increment usage for subscribed users
  if (!user.isSubscribed) {
    await incrementUserUsageDb(uid);
  }
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

export async function createCheckoutSession(uid: string): Promise<{ sessionId: string }> {
  const user = await getOrCreateUser(uid);
  const origin = headers().get('origin')!;
  
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!;
  if (!priceId) {
      throw new Error('Stripe Price ID is not configured.');
  }

  const sessionId = await createStripeCheckoutSession(
    uid,
    user.email,
    priceId,
    `${origin}/dashboard`,
    `${origin}/dashboard`
  );

  return { sessionId };
}

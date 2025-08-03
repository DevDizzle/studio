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
import { saveFeedback } from '@/lib/firebase';
import { 
    getStocksAdmin, 
    getOrCreateUserAdmin,
    incrementUserUsageAdmin,
} from '@/lib/firebase-admin';
import type { Stock } from '@/lib/firebase';
import { createStripeCheckoutSession } from '@/lib/stripe';
import { headers } from 'next/headers';
import { randomUUID } from 'crypto';


export async function getStocks(): Promise<Stock[]> {
    return getStocksAdmin();
}

export async function handleGetRecommendation(uid: string, input: InitialRecommendationInput): Promise<InitialRecommendationOutput | { error: string; required?: 'subscription' | 'auth' }> {
  const traceId = randomUUID();
  console.log(JSON.stringify({
    traceId,
    action: 'handleGetRecommendation.start',
    uid,
    input
  }));
  
  try {
    console.log(JSON.stringify({ traceId, msg: 'Attempting to get or create user using Admin SDK.' }));
    const user = await getOrCreateUserAdmin(uid);
    console.log(JSON.stringify({ traceId, msg: 'Successfully got or created user.', isSubscribed: user.isSubscribed, usageCount: user.usageCount }));
    
    if (user.usageCount >= 5 && !user.isSubscribed) {
      console.warn(JSON.stringify({ traceId, warning: 'Usage limit reached', required: 'subscription' }));
      return { error: 'Usage limit reached', required: 'subscription' };
    }
    
    // Don't increment usage for subscribed users
    if (!user.isSubscribed) {
      console.log(JSON.stringify({ traceId, msg: 'Attempting to increment user usage with Admin SDK.' }));
      await incrementUserUsageAdmin(uid);
      console.log(JSON.stringify({ traceId, msg: 'Successfully incremented user usage.' }));
    }

    const flowInput = { ...input, traceId };
    
    console.log(JSON.stringify({ traceId, msg: 'Calling getInitialRecommendation flow.' }));
    const result: InitialRecommendationOutput = await getInitialRecommendation(flowInput);
    console.log(JSON.stringify({ traceId, msg: 'Successfully received result from getInitialRecommendation flow.' }));
    
    return result;

  } catch(error: any) {
    console.error(JSON.stringify({
        traceId,
        action: 'handleGetRecommendation.error',
        error: {
            message: error.message,
            stack: error.stack,
        }
    }));
    // Re-throw the error to be caught by the client
    throw error;
  }
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
  const user = await getOrCreateUserAdmin(uid);
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

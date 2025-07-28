import { config } from 'dotenv';
config();

import '@/ai/flows/initial-recommendation.ts';
import '@/ai/flows/feedback-summarization.ts';
import '@/ai/flows/follow-up-questions.ts';
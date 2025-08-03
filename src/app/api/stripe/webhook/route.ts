import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { setUserSubscriptionStatus, getUserByStripeCustomerId } from '@/lib/firebase';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

async function handleSubscriptionChange(subscription: Stripe.Subscription, isSubscribed: boolean) {
    const customerId = subscription.customer as string;
    const user = await getUserByStripeCustomerId(customerId);

    if (user) {
        await setUserSubscriptionStatus(user.uid, isSubscribed);
    } else {
        console.warn(`Webhook Error: No user found with Stripe Customer ID: ${customerId}`);
    }
}


export async function POST(req: NextRequest) {
  const buf = await req.text();
  const sig = headers().get('Stripe-Signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
        const subscriptionUpdated = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscriptionUpdated, subscriptionUpdated.status === 'active');
        break;
    case 'customer.subscription.deleted':
        const subscriptionDeleted = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscriptionDeleted, false);
        break;
    case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            await handleSubscriptionChange(subscription, true);
        }
        break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

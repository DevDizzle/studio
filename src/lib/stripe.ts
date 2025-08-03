import Stripe from 'stripe';
import { getOrCreateUser } from './firebase';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
});

export async function createStripeCheckoutSession(
    uid: string,
    email: string | null | undefined,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    let user = await getOrCreateUser(uid);
    let customerId = user.stripeCustomerId;

    // Create a new Stripe customer if one doesn't exist
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: email ?? undefined,
            metadata: {
                firebaseUID: uid,
            },
        });
        customerId = customer.id;
        // Update user in Firebase with the new Stripe Customer ID
        await getOrCreateUser(uid, user.isAnonymous, user.displayName, user.email, customerId);
    }
  
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  
    if (!session.id) {
        throw new Error('Could not create Stripe Checkout Session.');
    }
    
    return session.id;
}

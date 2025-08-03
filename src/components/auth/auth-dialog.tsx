'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { createCheckoutSession } from '@/app/actions';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
      <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-69.5 69.5c-23.6-22.6-55.2-36.3-90.4-36.3-82.9 0-149.6 66.2-149.6 148.4s66.7 148.4 149.6 148.4c97.1 0 134.3-70.8 138.8-103.8H248v-85.3h236.1c2.3 12.7 3.9 26.9 3.9 41.4z"></path>
    </svg>
  );

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubscribe?: () => void;
  showSubscribeButton?: boolean;
};

export function AuthDialog({ open, onOpenChange, onSubscribe, showSubscribeButton = false }: AuthDialogProps) {
  const { user, signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [loading, setLoading] = useState<'google' | 'email' | 'subscribe' | null>(null);
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setLoading('google');
    try {
      await signInWithGoogle();
      onOpenChange(false);
      toast({ title: "Successfully signed in with Google." });
    } catch (error: any) {
      toast({
        title: "Google Sign-In Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('email');
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        onOpenChange(false);
        toast({ title: "Account created successfully!" });
      } else {
        await signInWithEmail(email, password);
        onOpenChange(false);
        toast({ title: "Successfully signed in." });
      }
    } catch (error: any) {
       toast({
        title: isSignUp ? "Sign-Up Failed" : "Sign-In Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };
  
   const handleSubscribeClick = async () => {
      if (!user) {
        toast({
            title: "Authentication Error",
            description: "You must be signed in to subscribe.",
            variant: "destructive"
        })
        return;
      };
      setLoading('subscribe');
      try {
          const { sessionId } = await createCheckoutSession(user.uid);
          const stripe = await stripePromise;
          const { error } = await stripe!.redirectToCheckout({ sessionId });
          if (error) {
              toast({
                title: "Checkout Error",
                description: error.message,
                variant: 'destructive',
              });
          }
      } catch (error) {
          toast({
            title: "Subscription Error",
            description: "Could not initiate the subscription process. Please try again.",
            variant: 'destructive',
          });
      } finally {
        setLoading(null);
      }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isSignUp ? 'Create an Account' : 'Sign In'}</DialogTitle>
          <DialogDescription>
            {isSignUp ? 'Sign up to continue using ProfitScout.' : 'Sign in to your account.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-4">
          {showSubscribeButton && (
             <Button onClick={handleSubscribeClick} disabled={!!loading}>
                {loading === 'subscribe' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Subscribe to Pro
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={!!loading}
          >
            {loading === 'google' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
            {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!!loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={!!loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!!loading}>
               {loading === 'email' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="underline hover:text-primary"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

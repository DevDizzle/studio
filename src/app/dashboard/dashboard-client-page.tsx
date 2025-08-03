'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Bot, Loader2, MessageSquare, Send, Settings, User, Sparkles, Menu, RefreshCw } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { getOrCreateUser } from '@/lib/firebase';
import type { Stock } from '@/lib/firebase';
import { handleGetRecommendation, handleFollowUp, handleFeedback, createCheckoutSession, getStocks } from '../actions';
import { MultiSelect, type Option } from '@/components/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  type InitialRecommendationOutput
} from '@/ai/flows/initial-recommendation';
import { Markdown } from '@/components/markdown';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SubscriptionDialog } from '@/components/auth/subscription-dialog';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string | React.ReactNode;
};

interface DashboardClientPageProps {
    initialStocks: Stock[];
}

export function DashboardClientPage({ initialStocks }: DashboardClientPageProps) {
  const { user, loading: authLoading } = useAuth();
  const [stockOptions, setStockOptions] = useState<Option[]>([]);
  const [selectedTickers, setSelectedTickers] = useState<Option[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingStocks, setIsFetchingStocks] = useState(false);
  const [initialRecommendation, setInitialRecommendation] = useState<InitialRecommendationOutput | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const options = initialStocks.map((stock: Stock) => ({
        value: stock.bundle_gcs_path,
        label: `${stock.id} - ${stock.company_name}`,
    }));
    setStockOptions(options);
  }, [initialStocks]);

  useEffect(() => {
    if (user) {
      getOrCreateUser(user.uid, user.isAnonymous).then(dbUser => {
        setUsageCount(dbUser.usageCount);
        setIsSubscribed(dbUser.isSubscribed);
      });
    }
  }, [user]);

  const fetchStocks = useCallback(async () => {
    setIsFetchingStocks(true);
    try {
      const stocks = await getStocks();
      const options = stocks.map((stock: Stock) => ({
        value: stock.bundle_gcs_path,
        label: `${stock.id} - ${stock.company_name}`,
      }));
      setStockOptions(options);
    } catch (error) {
      console.error("Failed to fetch stocks:", error);
      toast({
          title: "Error fetching stocks",
          description: "Could not load stock data. Please try again.",
          variant: "destructive"
      })
    } finally {
      setIsFetchingStocks(false);
    }
  }, [toast]);

  const handleTickerSelection = (selected: Option[]) => {
    setSelectedTickers(selected);
  };

  const checkUsageLimit = async () => {
    if (!user) return false;
    const dbUser = await getOrCreateUser(user.uid, user.isAnonymous);
    setUsageCount(dbUser.usageCount);
    setIsSubscribed(dbUser.isSubscribed);
    if (dbUser.usageCount >= 5 && !dbUser.isSubscribed) {
      setShowSubscriptionDialog(true);
      return false;
    }
    return true;
  }
  
  const getRecommendation = async () => {
    if (isLoading || selectedTickers.length === 0 || !user) return;
    if (!(await checkUsageLimit())) return;

    setIsLoading(true);
    setIsSheetOpen(false);
    setMessages([]);

    let ticker: string | undefined;
    let companyName: string | undefined;

    if (selectedTickers.length === 1) {
      [ticker, companyName] = selectedTickers[0].label.split(' - ');
    }

    setMessages([{ role: 'assistant', content: <MessageSkeleton /> }]);

    try {
      const analysisResult = await handleGetRecommendation(user.uid, {
        uris: selectedTickers.map(t => t.value),
        ticker: ticker,
        companyName: companyName,
      });

      if ('error' in analysisResult && analysisResult.required === 'subscription') {
         setShowSubscriptionDialog(true);
         setMessages([]);
         setIsLoading(false);
         return;
      }
      if ('error' in analysisResult) {
          throw new Error(analysisResult.error);
      }
      
      const dbUser = await getOrCreateUser(user.uid, user.isAnonymous);
      setUsageCount(dbUser.usageCount);


      setInitialRecommendation(analysisResult);

      let recommendationText = analysisResult.recommendation;
      
      const fullMessage = `
**Recommendation:** ${recommendationText}

**Reasoning:**
${analysisResult.reasoning.map((item: string) => `- ${item}`).join('\n')}
      `;

      setMessages([{ role: 'assistant', content: fullMessage.trim() }]);
    } catch (error) {
      console.error("Failed to get recommendation:", error);
      toast({
        title: "Analysis Failed",
        description: "Could not generate the analysis. Please try again.",
        variant: "destructive",
      });
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getAITopPick = async () => {
      if (!user) return;
      if (!(await checkUsageLimit())) return;

      setIsLoading(true);
      setIsSheetOpen(false);
      setMessages([]);
      setSelectedTickers([]);

      setMessages([{ role: 'assistant', content: <MessageSkeleton /> }]);

      try {
          const randomStocks = await getStocks();
          if (randomStocks.length === 0) {
              throw new Error("No stocks available in the database.");
          }
          
          const uris = randomStocks.map(s => s.bundle_gcs_path);
          const analysisResult = await handleGetRecommendation(user.uid, { uris });

          if ('error' in analysisResult && analysisResult.required === 'subscription') {
            setShowSubscriptionDialog(true);
            setMessages([]);
            setIsLoading(false);
            return;
          }
           if ('error' in analysisResult) {
              throw new Error(analysisResult.error);
           }
          
          const dbUser = await getOrCreateUser(user.uid, user.isAnonymous);
          setUsageCount(dbUser.usageCount);

          setInitialRecommendation(analysisResult);

          const recommendationText = `
**Recommendation:** ${analysisResult.recommendation}

**Reasoning:**
${analysisResult.reasoning.map((item: string) => `- ${item}`).join('\n')}
          `;
          setMessages([{ role: 'assistant', content: recommendationText.trim() }]);
      } catch (error) {
          console.error("Failed to get AI Top Pick:", error);
          toast({
              title: "AI Top Pick Failed",
              description: "Could not generate the AI Top Pick. Please try again.",
              variant: "destructive",
          });
          setMessages([]);
      } finally {
          setIsLoading(false);
      }
  };


  const submitFollowUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const question = formData.get('question') as string;
    if (!question || isLoading || !initialRecommendation) return;

    event.currentTarget.reset();

    const userMessage: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'assistant', content: <MessageSkeleton /> }]);

    const chatHistory = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: typeof m.content === 'string' ? m.content : '...',
    }));

    const initialRecommendationText = `
**Recommendation:** ${initialRecommendation.recommendation}

**Reasoning:**
${initialRecommendation.reasoning.map((item: string) => `- ${item}`).join('\n')}
  `;
    
    try {
      const result = await handleFollowUp({
        question,
        tickers: selectedTickers.map(t => t.label.split(' - ')[0]),
        initialRecommendation: initialRecommendationText.trim(),
        chatHistory,
      });

      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: result.answer }]);
    } catch (error) {
      console.error("Follow-up failed:", error);
      toast({
        title: "Follow-up Failed",
        description: "Could not get an answer. Please try again.",
        variant: "destructive",
      });
      setMessages(prev => prev.slice(0, -2));
    } finally {
      setIsLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setIsLoading(true);
    await handleFeedback(feedbackText);
    setFeedbackText('');
    setIsSheetOpen(false);
    toast({
      title: 'Feedback Submitted',
      description: 'Thank you for helping us improve ProfitScout!',
    });
    setIsLoading(false);
  };
  
  const handleSubscribeClick = async () => {
      if (!user) return;
      setIsCheckingOut(true);
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
        setIsCheckingOut(false);
      }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const renderAnalysisControls = () => {
    if (authLoading && stockOptions.length === 0) {
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium">Stock Tickers (Max 2)</label>
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Stock Tickers (Max 2)</label>
          <Button variant="ghost" size="icon" onClick={fetchStocks} disabled={isFetchingStocks} aria-label="Refresh stocks">
            <RefreshCw className={`h-4 w-4 ${isFetchingStocks ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <MultiSelect
          options={stockOptions}
          selected={selectedTickers}
          onChange={handleTickerSelection}
          className="w-full"
          placeholder="Select up to 2 stocks..."
          max={2}
          disabled={authLoading}
        />
      </div>
    );
  }
  
  const SidebarContent = () => (
    <div className="p-4 flex flex-col gap-4 h-full bg-background">
        <h1 className="text-2xl font-bold font-headline mb-4">ProfitScout</h1>
        
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
                <Settings className="text-primary" />
                Stock Analysis
            </CardTitle>
            <CardDescription>Select stocks to analyze or compare</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col gap-4">
            {renderAnalysisControls()}
             <p className="text-sm text-muted-foreground text-center">
              {isSubscribed ? 'Premium Account' : `${Math.max(0, 5 - usageCount)} / 5 free analyses remaining.`}
            </p>
            <Button onClick={getRecommendation} disabled={isLoading || authLoading || selectedTickers.length === 0} className="w-full mt-auto">
              {isLoading && messages.length > 0 && selectedTickers.length > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Launch Analysis
            </Button>
          </CardContent>
        </Card>
        
        <Card className="flex-1 flex flex-col">
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <Sparkles className="text-primary" />
                    AI Top Pick
                </CardTitle>
                <CardDescription>Let our AI find the best stock for you right now.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-end gap-4">
                 <p className="text-sm text-muted-foreground text-center">
                   {isSubscribed ? 'Premium Account' : `${Math.max(0, 5 - usageCount)} / 5 free analyses remaining.`}
                </p>
                <Button onClick={getAITopPick} disabled={isLoading || authLoading} className="w-full">
                    {isLoading && selectedTickers.length === 0 && messages.length > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Get AI Top Pick
                </Button>
            </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col">
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <MessageSquare className="text-primary" />
                    Feedback
                </CardTitle>
                 <CardDescription>Help us improve ProfitScout!</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4">
                <Textarea
                    placeholder="Tell us what you think..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={3}
                    className="flex-grow"
                    disabled={isLoading}
                />
                <Button onClick={submitFeedback} className="w-full" disabled={!feedbackText.trim() || isLoading}>
                    {isLoading && !messages.length ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Feedback
                </Button>
            </CardContent>
        </Card>
      </div>
  );

  return (
    <>
    <SubscriptionDialog 
        open={showSubscriptionDialog} 
        onOpenChange={setShowSubscriptionDialog}
        onSubscribe={handleSubscribeClick}
        loading={isCheckingOut}
    />
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      <aside className="w-[350px] flex-shrink-0 border-r border-border hidden md:flex">
        <SidebarContent />
      </aside>
      <main className="flex-1 flex flex-col p-4">
         <header className="flex items-center justify-between md:hidden border-b border-border pb-4 mb-4">
           <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open controls</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[350px]">
              <SidebarContent />
            </SheetContent>
          </Sheet>
           <h1 className="text-xl font-bold font-headline text-primary">ProfitScout</h1>
         </header>
         <div className="flex-grow flex flex-col">
            {renderChat()}
         </div>
      </main>
    </div>
    </>
  );

  function renderChat() {
     if (messages.length === 0 && !isLoading) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Bot className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Welcome to ProfitScout</h2>
                <p className="max-w-md mt-2">To get started, select one or two stocks and click "Launch Analysis", or let our AI find a top pick for you.</p>
            </div>
        )
    }

    return (
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col p-4">
          <ScrollArea className="flex-grow pr-4" ref={scrollAreaRef}>
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                  {message.role === 'assistant' && (
                    <div className="bg-primary rounded-full p-2">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`max-w-prose rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-card'
                    }`}
                  >
                    {typeof message.content === 'string' ? (
                        <Markdown content={message.content} />
                    ) : (
                        message.content
                    )}
                  </div>
                  {message.role === 'user' && (
                     <div className="bg-secondary rounded-full p-2">
                       <User className="h-5 w-5 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="mt-4 pt-4 border-t border-border">
            <form onSubmit={submitFollowUp} className="flex items-center gap-2">
              <Input
                name="question"
                placeholder="Ask a follow-up question..."
                className="flex-1"
                disabled={isLoading || authLoading || messages.length === 0 || initialRecommendation === null}
              />
              <Button type="submit" disabled={isLoading || authLoading || messages.length === 0 || initialRecommendation === null} size="icon" aria-label="Send message">
                {isLoading && messages.some(m => m.role === 'user') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    );
  }
}

const MessageSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
    <Skeleton className="h-4 w-[220px]" />
  </div>
);

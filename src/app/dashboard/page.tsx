'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Building2, GitCompareArrows, Loader2, MessageSquare, PieChart, Send, Settings, User, Sparkles, Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getStocks, type Stock } from '@/lib/firebase';
import { handleGetRecommendation, handleFollowUp, handleFeedback } from '../actions';
import { MultiSelect, type Option } from '@/components/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  type InitialRecommendationInput,
  type InitialRecommendationOutput
} from '@/ai/flows/initial-recommendation';
import { Markdown } from '@/components/markdown';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';


type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string | React.ReactNode;
};

// Placeholder data
const SECTORS = [
    { value: 'tech', label: 'Technology' },
    { value: 'health', label: 'Healthcare' },
    { value: 'finance', label: 'Finance' },
];

const INDUSTRIES = [
    { value: 'saas', label: 'SaaS' },
    { value: 'pharma', label: 'Pharmaceuticals' },
    { value: 'banking', label: 'Banking' },
];

export default function DashboardPage() {
  const [stockOptions, setStockOptions] = useState<Option[]>([]);
  const [selectedTickers, setSelectedTickers] = useState<Option[]>([]);
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingStocks, setIsFetchingStocks] = useState(true);
  const [initialRecommendation, setInitialRecommendation] = useState<InitialRecommendationOutput | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [activeTab, setActiveTab] = useState('stock-analysis');
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchStocks() {
      setIsFetchingStocks(true);
      try {
        const stocks = await getStocks();
        const options = stocks.map((stock: Stock) => ({
          value: stock.bundle_gcs_path, // Pass GCS path as value
          label: `${stock.id} - ${stock.company_name}`,
        }));
        setStockOptions(options);
      } catch (error) {
        console.error("Failed to fetch stocks:", error);
        toast({
            title: "Error fetching stocks",
            description: "Could not load stock data. Please check your Firebase configuration and security rules.",
            variant: "destructive"
        })
      } finally {
        setIsFetchingStocks(false);
      }
    }
    fetchStocks();
  }, [toast]);

  const handleTickerSelection = (selected: Option[]) => {
    setSelectedTickers(selected);
  };
  
  const getRecommendation = async () => {
    if (isLaunchAnalysisDisabled()) return;

    setIsLoading(true);
    setIsSheetOpen(false);
    setMessages([]);

    let ticker: string | undefined;
    let companyName: string | undefined;

    if (activeTab === 'stock-analysis' && selectedTickers.length === 1) {
      [ticker, companyName] = selectedTickers[0].label.split(' - ');
    }

    let input: InitialRecommendationInput = {
      uris: [],
      ticker: ticker,
      companyName: companyName,
    };

    if (activeTab === 'stock-analysis') {
      input.uris = selectedTickers.map(t => t.value);
    } else if (activeTab === 'sector-analysis') {
      input.sector = selectedSector;
    } else if (activeTab === 'industry-analysis') {
      input.sector = selectedIndustry;
    }

    setMessages([{ role: 'assistant', content: <MessageSkeleton /> }]);

    try {
      const result = await handleGetRecommendation(input);
      setInitialRecommendation(result);

      let recommendationText = result.recommendation;

      if (activeTab === 'stock-analysis' && selectedTickers.length === 1 && ticker && companyName) {
        const firstWordMatch = recommendationText.match(/^\w+/);
        if (firstWordMatch) {
            const recommendation = firstWordMatch[0];
            const restOfSentence = recommendationText.substring(recommendation.length);
            recommendationText = `**${recommendation}** - **${ticker}** - **${companyName}**${restOfSentence}`;
        }
      } else if (activeTab === 'stock-analysis' && selectedTickers.length === 0) { // AI Top Pick
        const parts = result.recommendation.split('–');
        const tickerAndName = (parts.shift() || '').replace('AI Top Pick:', '').trim();
        const summary = (parts.join('–') || '').trim();
        recommendationText = `**AI Top Pick: ${tickerAndName}** – ${summary}`;
      } else if (activeTab === 'stock-analysis' && selectedTickers.length > 1) {
          const firstWordMatch = recommendationText.match(/^\w+/);
          if (firstWordMatch) {
              const recommendation = firstWordMatch[0];
              const restOfSentence = recommendationText.substring(recommendation.length);
              recommendationText = `**${recommendation}**${restOfSentence}`;
          }
      }
      
      const fullMessage = `
**Recommendation:** ${recommendationText}

**Reasoning:**
${result.reasoning.map((item: string) => `- ${item}`).join('\n')}

**Key Sections Overview:**
${result.sections_overview.map((item: string) => `- ${item}`).join('\n')}
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
      setIsLoading(true);
      setIsSheetOpen(false);
      setMessages([]);
      setSelectedTickers([]);

      setMessages([{ role: 'assistant', content: <MessageSkeleton /> }]);

      try {
          const randomStocks = await getStocks(); // Use all stocks
          if (randomStocks.length === 0) {
              throw new Error("No stocks available in the database.");
          }
          
          const uris = randomStocks.map(s => s.bundle_gcs_path);
          const result = await handleGetRecommendation({ uris });

          setInitialRecommendation(result);

          const recommendationText = `
**Recommendation:** ${result.recommendation}

**Reasoning:**
${result.reasoning.map((item: string) => `- ${item}`).join('\n')}

**Key Sections Overview:**
${result.sections_overview.map((item: string) => `- ${item}`).join('\n')}
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

    // Add skeleton for response
    setMessages(prev => [...prev, { role: 'assistant', content: <MessageSkeleton /> }]);

    const chatHistory = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: typeof m.content === 'string' ? m.content : '...',
    }));

    const initialRecommendationText = `
**Recommendation:** ${initialRecommendation.recommendation}

**Reasoning:**
${initialRecommendation.reasoning.map((item: string) => `- ${item}`).join('\n')}

**Key Sections Overview:**
${initialRecommendation.sections_overview.map((item: string) => `- ${item}`).join('\n')}
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
      // remove the user message and skeleton
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
  
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  useEffect(() => {
    setSelectedTickers([]);
    setSelectedSector('');
    setSelectedIndustry('');
    setMessages([]);
    setInitialRecommendation(null);
  }, [activeTab]);
  
  const isLaunchAnalysisDisabled = () => {
    switch (activeTab) {
        case 'stock-analysis':
            return isLoading || selectedTickers.length === 0;
        case 'sector-analysis':
            return isLoading || !selectedSector;
        case 'industry-analysis':
            return isLoading || !selectedIndustry;
        default:
            return true;
    }
  }

  const renderAnalysisControls = () => {
    if (isFetchingStocks) {
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium">Stock Tickers (Max 2)</label>
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    
    switch(activeTab) {
      case 'stock-analysis':
        return (
          <div className="space-y-2">
            <label className="text-sm font-medium">Stock Tickers (Max 2)</label>
            <MultiSelect
              options={stockOptions}
              selected={selectedTickers}
              onChange={handleTickerSelection}
              className="w-full"
              placeholder="Select up to 2 stocks..."
              max={2}
            />
          </div>
        );
      case 'sector-analysis':
        return (
           <div className="space-y-2">
            <label className="text-sm font-medium">Sector</label>
            <Select onValueChange={setSelectedSector} value={selectedSector}>
              <SelectTrigger>
                <SelectValue placeholder="Select a sector..." />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map(sector => (
                    <SelectItem key={sector.value} value={sector.label}>
                        {sector.label}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'industry-analysis':
        return (
           <div className="space-y-2">
            <label className="text-sm font-medium">Industry</label>
             <Select onValueChange={setSelectedIndustry} value={selectedIndustry}>
              <SelectTrigger>
                <SelectValue placeholder="Select an industry..." />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map(industry => (
                    <SelectItem key={industry.value} value={industry.label}>
                        {industry.label}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      default:
        return null;
    }
  }
  
  const SidebarContent = () => (
    <div className="p-4 flex flex-col gap-4 h-full bg-background">
        <h1 className="text-2xl font-bold font-headline mb-4">ProfitScout</h1>
        
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
                <Settings className="text-primary" />
                Controls
            </CardTitle>
            <CardDescription>Select analysis type and options</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col gap-4">
            {renderAnalysisControls()}
            <Button onClick={getRecommendation} disabled={isLaunchAnalysisDisabled()} className="w-full mt-auto">
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
            <CardContent className="flex-grow flex flex-col">
                <Button onClick={getAITopPick} disabled={isLoading} className="w-full mt-auto">
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
    <div className="flex h-screen bg-background">
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
         <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stock-analysis"><GitCompareArrows className="mr-2" />Stock Analysis</TabsTrigger>
            <TabsTrigger value="sector-analysis"><PieChart className="mr-2" />Sector Analysis</TabsTrigger>
            <TabsTrigger value="industry-analysis"><Building2 className="mr-2" />Industry Analysis</TabsTrigger>
          </TabsList>
          <TabsContent value="stock-analysis" className="flex flex-col mt-4 flex-grow">
            {renderChat()}
          </TabsContent>
          <TabsContent value="sector-analysis" className="flex flex-col mt-4 flex-grow">
            {renderChat()}
          </TabsContent>
          <TabsContent value="industry-analysis" className="flex flex-col mt-4 flex-grow">
            {renderChat()}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );

  function renderChat() {
     if (messages.length === 0 && !isLoading) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Bot className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Welcome to ProfitScout</h2>
                <p className="max-w-md mt-2">To get started, configure your analysis in the controls panel and launch your analysis.</p>
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
                disabled={isLoading || messages.length === 0 || initialRecommendation === null}
              />
              <Button type="submit" disabled={isLoading || messages.length === 0 || initialRecommendation === null} size="icon" aria-label="Send message">
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

    
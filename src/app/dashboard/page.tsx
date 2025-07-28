'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Building2, GitCompareArrows, LineChart, Loader2, PieChart, Send, User, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { STOCKS } from '@/lib/stocks';
import { handleGetRecommendation, handleFollowUp, handleFeedback } from '../actions';
import { MultiSelect, type Option } from '@/components/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const [selectedTickers, setSelectedTickers] = useState<Option[]>([]);
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'Select an analysis type and make a selection to start.',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialRecommendation, setInitialRecommendation] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [activeTab, setActiveTab] = useState('ai-top-pick');

  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const stockOptions: Option[] = STOCKS.map(stock => ({
    value: stock.value,
    label: `${stock.value} - ${stock.label}`,
  }));

  const handleTickerSelection = (selected: Option[]) => {
    const limit = activeTab === 'ai-top-pick' ? 1 : 2;
    if (selected.length <= limit) {
      setSelectedTickers(selected);
    }
  };

  const getRecommendation = async () => {
    if (selectedTickers.length === 0) return;
    
    setIsLoading(true);
    setMessages([]);
    
    const tickerValues = selectedTickers.map(t => t.value);
    
    // Optimistically show a loading skeleton
    setMessages([{ role: 'assistant', content: <MessageSkeleton /> }]);

    const result = await handleGetRecommendation(tickerValues);
    
    setInitialRecommendation(result.recommendation);
    setMessages([{ role: 'assistant', content: result.recommendation }]);
    setIsLoading(false);
  };

  const submitFollowUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const question = formData.get('question') as string;
    if (!question || isLoading) return;

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
    
    const result = await handleFollowUp({
      question,
      tickers: selectedTickers.map(t => t.value),
      initialRecommendation,
      chatHistory,
    });

    setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: result.answer }]);
    setIsLoading(false);
  };

  const submitFeedback = async () => {
    if (!feedbackText.trim()) return;
    await handleFeedback(feedbackText);
    setFeedbackText('');
    toast({
      title: 'Feedback Submitted',
      description: 'Thank you for helping us improve ProfitScout!',
    });
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
    setMessages([
      {
        role: 'system',
        content: 'Select an analysis type and make a selection to start.',
      },
    ]);
  }, [activeTab]);
  
  const isGetRecommendationDisabled = () => {
    switch (activeTab) {
        case 'ai-top-pick':
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

  const renderControls = () => {
    switch(activeTab) {
      case 'ai-top-pick':
        return (
          <div className="space-y-2">
            <label className="text-sm font-medium">Stock Ticker</label>
            <MultiSelect
              options={stockOptions}
              selected={selectedTickers}
              onChange={handleTickerSelection}
              className="w-full"
              placeholder="Select a stock..."
              max={1}
            />
          </div>
        );
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
                    <SelectItem key={sector.value} value={sector.value}>
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
                    <SelectItem key={industry.value} value={industry.value}>
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

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-[350px] flex-shrink-0 border-r border-border p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold font-headline">ProfitScout</h1>
        </div>
        <Card className="flex-grow flex flex-col">
          <CardHeader>
            <CardTitle className="font-headline">Controls</CardTitle>
            <CardDescription>Select analysis type and options</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col gap-4">
            {renderControls()}
            <Button onClick={getRecommendation} disabled={isGetRecommendationDisabled()} className="w-full mt-2">
              {isLoading && messages.length === 1 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Get Recommendation
            </Button>
          </CardContent>
          <div className="p-4 border-t border-border mt-auto">
             <div className="space-y-2">
              <label className="text-sm font-medium">Feedback</label>
              <Textarea
                placeholder="Tell us what you think..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={4}
              />
              <Button onClick={submitFeedback} variant="secondary" className="w-full" disabled={!feedbackText.trim()}>
                Submit Feedback
              </Button>
            </div>
          </div>
        </Card>
      </aside>
      <main className="flex-1 flex flex-col p-4">
         <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ai-top-pick" className={cn(activeTab === 'ai-top-pick' && 'bg-accent/20 text-accent-foreground border border-accent/50')}>
              <Sparkles className="mr-2" />AI Top Pick
            </TabsTrigger>
            <TabsTrigger value="stock-analysis"><GitCompareArrows className="mr-2" />Stock Analysis</TabsTrigger>
            <TabsTrigger value="sector-analysis"><PieChart className="mr-2" />Sector Analysis</TabsTrigger>
            <TabsTrigger value="industry-analysis"><Building2 className="mr-2" />Industry Analysis</TabsTrigger>
          </TabsList>
          <TabsContent value="ai-top-pick" className="flex-grow flex flex-col mt-4">
            {renderChat()}
          </TabsContent>
          <TabsContent value="stock-analysis" className="flex-grow flex flex-col mt-4">
            {renderChat()}
          </TabsContent>
          <TabsContent value="sector-analysis" className="flex-grow flex flex-col mt-4">
            {renderChat()}
          </TabsContent>
          <TabsContent value="industry-analysis" className="flex-grow flex flex-col mt-4">
            {renderChat()}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );

  function renderChat() {
     const showChat = (activeTab === 'ai-top-pick' || activeTab === 'stock-analysis') || (messages.length > 1 || (messages.length === 1 && messages[0].role !== 'system'));

    if (!showChat && (activeTab === 'sector-analysis' || activeTab === 'industry-analysis')) {
        return (
            <div className="flex-grow flex items-center justify-center text-muted-foreground">
                <p>Select a {activeTab.split('-')[0]} to begin analysis.</p>
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
                    <div className="prose prose-invert text-sm break-words">{message.content}</div>
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
                disabled={isLoading || messages.length === 0 || initialRecommendation === ''}
              />
              <Button type="submit" disabled={isLoading || messages.length === 0 || initialRecommendation === ''} size="icon" aria-label="Send message">
                {isLoading && messages.length > 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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

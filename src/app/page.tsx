import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Bot, GitCompareArrows, MessageCircleQuestion, Sparkles } from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: <Bot className="h-8 w-8 text-primary" />,
    title: "AI Stock Signals",
    description: "Clear Buy, Hold, or Sell guidance powered by advanced AI."
  },
  {
    icon: <GitCompareArrows className="h-8 w-8 text-primary" />,
    title: "Stock Comparisons",
    description: "Side-by-side analysis for smarter investing decisions."
  },
    {
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    title: "AI’s Top Stock Pick",
    description: "Discover today's best investment opportunity, handpicked by our AI."
  },
  {
    icon: <MessageCircleQuestion className="h-8 w-8 text-primary" />,
    title: "Chat & Learn",
    description: "Ask follow-up questions and explore deeper insights with our conversational AI."
  }
]

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold font-headline text-primary">ProfitScout</h1>
          <Button asChild variant="ghost">
            <Link href="/dashboard">Sign In</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 text-center py-20 sm:py-32">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-headline tracking-tight">
            Invest Smarter with ProfitScout
          </h2>
          <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            Get clear AI-powered recommendations—Buy, Hold, or Sell—in seconds.
            Stop guessing. Start investing confidently.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" className="font-bold">
              <Link href="/dashboard">
                Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-card/50 border-border/50 text-center">
                <CardContent className="p-6">
                  <div className="flex justify-center mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold font-headline">{feature.title}</h3>
                  <p className="mt-2 text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} ProfitScout. All rights reserved.</p>
      </footer>
    </div>
  );
}

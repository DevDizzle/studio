# **App Name**: ProfitScout

## Core Features:

- Landing Page: Landing page with strong copywriting emphasizing stock recommendations. It includes a hero section, bullet points on key features, and a sign-in button.
- Tabbed Interface: Post-authentication, users access a tabbed interface for 'Deep Dive', 'Comparison', 'Sector Analysis', and 'Industry Analysis'. A left-aligned sidebar provides ticker selection and a feedback submission tool.
- Chat UI: The chat UI includes an input field for follow-up questions and a scrolling history of interactions, ensuring a seamless and context-aware conversational experience.
- Multi-Ticker Selection: A multi-select dropdown limits users to 2 tickers from the database, triggering an initialization of the chat with recommendations specific to the selection. This feature manages single deep dives, multi comparisons, and industry/sector.
- Synthesizer Agent: The synthesizer tool crafts responses with chain-of-thought, grounded in real-time data, to provide buy/hold/sell advice on up to 2 Russell 1000 stocks, ensuring focused and reliable analysis for the end user. The LLM will use a tool to decide when to incorporate outside information.
- Buy Button: User selects a Get Stock Recommendation Button, and we randomly select a BUY option from the Stock Firebase database.

## Style Guidelines:

- Deep desaturated blue-gray (#282A3A) to support dark mode, create a fintech feel, and allow for readable display of both text and graphical elements.
- Electric purple (#BE39FF) to draw user attention, and create a bold but trustworthy tech-centered vibe.
- Soft fuchsia (#D4348F) analogous to the primary color, yet contrasting, ideal for highlighting calls to action within the app.
- 'Inter' (sans-serif) which provides a modern, neutral feel.
- 'Space Grotesk' (sans-serif) complements 'Inter' with its techy look.
- Use simple line icons for navigation and data visualization. Color-code icons based on stock performance (green for gains, red for losses).
- Incorporate subtle transitions and loading animations to enhance user experience without being distracting. Use micro-interactions to provide feedback on user actions.
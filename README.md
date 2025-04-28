# openmuse | [openmuse.app](https://openmuse.app)

A fully-featured Retrieval-Augmented Generation (RAG) chat service for answering NBA or basketball-related questions. The project couples **Next.js** for the frontend & API layer with **LangChain**, **OpenAI-compatible LLMs**, and **MongoDB Atlas Vector Search** for contextual retrieval. 
*(Built as a reference implementation of a production-ready RAG architecture using only serverless components.)*

## Table of Contents

1. [Features](#features)
2. [High-Level Architecture](#high-level-architecture)
3. [Detailed Component Guide](#detailed-component-guide)
4. [Data / Control Flow](#data--control-flow)
5. [Project Structure](#project-structure)
6. [Environment Variables](#environment-variables)
7. [Getting Started](#getting-started)
8. [Extending the Bot](#extending-the-bot)

## Features

- **Chat UI** with streaming responses and optimistic rendering
- **Retrieval-Augmented Generation** – each user query is enriched with top-K context chunks fetched from MongoDB Atlas Vector Search
- **Provider Registry** that hot-swaps LLM vendors (OpenAI, Groq, OpenRouter, …)
- **Typed React / TypeScript** codebase, Tailwind CSS design system, shadcn/ui primitives
- **Serverless-first**: all compute is in edge/serverless functions; MongoDB Atlas handles persistence


## High-Level Architecture

```
┌──────────────┐        1. HTTP POST /api/chat            ┌──────────────────────────┐
│   Next.js    │ ───────────────────────────────────────▶ │  API Route (route.ts)    │
│   Chat UI    │                                          │  – validates payload     │
│ (page.tsx)   │                                          │  – calls retrieveContext │
└─────┬────────┘                                          └──────────┬───────────────┘
      │ 5. SSE stream ▲                                              │ 2. query string
      │              │                                               ▼
      │              │                                 ┌──────────────────────────────────────┐
      │              │        4. formatted answer      │  LLM Provider (ai-sdk -> OpenRouter) │
      │              └─────────────────────────────────│    – o4-mini-high                    │
      │                                                └──────────┬───────────────────────────┘
      │ 6. updates message list                               ▲   │ 3. Injected context
┌─────▼────────┐                                              │   │
│ React State  │                                              │   │
│   messages   │                                              │   │
└──────────────┘                                              │   │
                                                              │   │
                                        ┌─────────────────────┴───┴─────────────────┐
                                        │   RAG Layer (lib/rag.ts)                  │
                                        │  – similaritySearch(k) on MongoDB Atlas   │
                                        │  – returns \n\n---\n\n-joined chunks      │
                                        └───────────────────────────────────────────┘
```

### Key Design Decisions

| Concern                 | Decision                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| **Vector DB**     | MongoDB Atlas Vector Search – zero-maintenance, native similarity search                             |
| **Embeddings**    | `text-embedding-3-small` via LangChain `OpenAIEmbeddings`                                         |
| **LLM**           | Default:`openrouter:openai/o4-mini-high`; can be swapped via `lib/ai-config.ts`                   |
| **Streaming**     | `ai` SDK’s `streamText()` pipes tokens to the client through native **Server-Sent Events** |
| **Statelessness** | Chat history is held in the browser; the API only receives conversation slice sent from `useChat()` |

---

## Detailed Component Guide

### 1. Frontend (React / Next.js App Router)

| File             | Purpose                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `app/page.tsx` | Chat page; integrates `useChat()` hook, renders `BotMessage` / `UserMessage` components and message composer. |
| `components/`  | Reusable primitives (`ui/*` shadcn components) and message bubbles.                                               |

### 2. API Route – `/app/api/chat/route.ts`

Responsible for:

1. Extracting the **latest user message** from the request body.
2. Calling `retrieveContext(query)` (RAG layer).
3. Crafting a **system prompt** with injected context and query.
4. Streaming the answer back with `streamText()`.

### 3. RAG Layer – `lib/rag.ts`

- Creates a singleton `MongoClient` and binds to the `openmuse.nba` namespace.
- Wraps the collection in a LangChain `MongoDBAtlasVectorSearch` store.
- `retrieveContext()` executes `similaritySearch(query, k)` and returns a human-readable string joined by `---` separators.

### 4. AI Provider Registry – `lib/ai-config.ts`

- Central factory to register multiple OpenAI-compatible backends.
- Enables feature-flagging or A/B testing of different models without touching business logic.

### 5. Utilities – `lib/utils.ts`

- Tailwind-friendly `cn()` helper.
- `disableApp` flag controlled via `NEXT_PUBLIC_DISABLE_APP`.

---

## Data / Control Flow

1. **User types a question** and submits the form.
2. `useChat()` posts the full message array to `/api/chat`.
3. The API extracts the *latest* user query and calls **RAG retrieval**.
4. Top-K documents (default *k = 4*) are fetched from MongoDB and injected into a system prompt.
5. The prompt is streamed through the chosen LLM provider; tokens are flushed to the browser as they arrive.
6. The React component appends tokens, giving an instant typing effect.

---

## Project Structure

```
openmuseapp/
├─ app/                 # Next.js App Router tree
│  ├─ api/chat/route.ts # Serverless function (Edge)
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx          # Chat UI
├─ components/
│  ├─ messages.tsx      # Bot & User message bubbles
│  └─ ui/               # shadcn/ui primitives (button, card, input, avatar)
├─ lib/
│  ├─ ai-config.ts      # Provider registry
│  ├─ rag.ts            # RAG retrieval logic
│  └─ utils.ts
├─ public/              # Static assets
├─ tailwind.config.ts   # Design system tokens
├─ package.json
└─ README.md            # ← you are here
```

---

## Environment Variables

| Variable                    | Description                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`          | Key for OpenAI-compatible models (also used by OpenRouter)                             |
| `GROQ_API_KEY`            | Key for Groq LLMs (optional)                                                           |
| `OPENROUTER_API_KEY`      | Key for OpenRouter (optional)                                                          |
| `MONGODB_URI`             | MongoDB Atlas connection string**including username, password, and replica set** |
| `NEXT_PUBLIC_DISABLE_APP` | If truthy, disables the input field (useful for maintenance)                           |

Create a `.env` file at the project root:

```bash
OPENAI_API_KEY=sk-...
MONGODB_URI=mongodb+srv://<user>:<pw>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
# Optional:
GROQ_API_KEY=
OPENROUTER_API_KEY=
NEXT_PUBLIC_DISABLE_APP=false
```

---

## Getting Started

```bash
# 1. Install deps (uses pnpm)
pnpm install

# 2. Run the dev server
pnpm dev
# → localhost:3000
```

Indexer / Embedding Ingestion is **out of scope** for this repo. Populate the `openmuse.nba` collection with documents having:

```jsonc
{
  "_id": "...",
  "text": "Document contents …",
  "embedding": [0.123, 0.456, …]  // 1536-dim float32 vector
}
```

And ensure a corresponding Atlas **vector index** exists:

```js
{
  "fields": {
    "embedding": {
      "type": "vector",
      "dims": 1536,
      "similarity": "cosine"
    }
  }
}
```

---

## Extending the Bot

- **Model Switching** – edit `lib/ai-config.ts` or simply change `registry.languageModel()` call.
- **Custom Chunking / pre-processing** – adjust your ingestion pipeline to tailor chunk sizes.
- **UI Enhancements** – add citations, document previews, or an info side-panel (button already stubbed in `page.tsx`).
- **Logging & Monitoring** – plug in Vercel Analytics or your own observability stack.

# Product Spec: Unified Tri-Model AI Workspace

## Product Goal
Build a clean, responsive, reliable web app where a single user message is sent to Claude, ChatGPT, and Gemini simultaneously, while each model maintains an independent conversation thread and context.

## Problem Statement
The user currently repeats prompts manually across three AI tools and manually cross-shares responses. This creates high friction, especially on mobile. The app should eliminate duplicate work and streamline iterative multi-model reasoning.

## Target User
- Single-user power user
- Heavy daily usage on desktop and mobile browsers
- Needs speed, reliability, and minimal UI clutter

## Core Features

### Feature 1: Unified Prompt, Separate Conversations
- One global input sends each user message to all 3 models concurrently.
- Three independent model threads are shown in parallel:
  - Desktop: 3 columns
  - Mobile: 3 stacked panels
- Each model retains its own ongoing memory and full history for that conversation.
- Any follow-up message is again sent to all 3 models with each model’s own thread context.
- Starting a new conversation resets all three model contexts.
- Conversation history is persisted locally and can be reopened.

### Feature 2: Cross-Feed Responses Between Models
- A single **Cross-feed** action triggers concurrent requests to all 3 models.
- Each model receives the other two models’ latest responses as a new user message.
- All three responses are generated at the same time.
- Cross-feed can be repeated for multiple rounds.
- Each cross-feed round is stored as part of each model’s conversation context.

### Feature 3: Export Conversations
- Export any single conversation as a downloadable file.
- Export all conversations as a downloadable file.
- Export is copy-only and never deletes local data.
- Supported formats:
  - Required: JSON
  - Optional: Markdown

## UX / UI Requirements
- Clean, minimal interface optimized for power usage.
- Fully responsive for iPhone and Android browsers.
- Real-time streaming output in each model panel.
- Dark mode preferred/default.
- One-tap copy for any individual model response.
- Conversation sidebar/list for switching past sessions and starting new ones.
- Clear visual distinction among:
  - User messages
  - Model messages
  - Cross-feed rounds

## Model Configuration Requirements
- Per-provider model selection is required:
  - Claude family (e.g., Opus, Sonnet)
  - OpenAI family (e.g., GPT-5.2, GPT-5.3 Codex)
  - Gemini family (e.g., Pro, Flash)
- Selected model should be visible and adjustable in UI.

## Data & Storage Requirements
- No backend database.
- Local-only persistence in browser storage.
- API keys stored locally (single-user tool, no auth system required).

## Reliability & Error Handling Requirements
- Graceful handling of rate limits, transient failures, and network interruptions.
- Retries for transient errors with clear UI feedback.
- Model-level error isolation (one provider failing should not block the others).

## Usage / Cost Requirements
- Display token usage and estimated spend at a general level.
- Provide per-conversation and overall summary.

## Out of Scope (MVP)
- Multi-user accounts and collaboration
- Cloud sync
- Backend auth and server-side key management
- Enterprise analytics and admin features

## Acceptance Criteria
1. One message sends to all 3 providers concurrently.
2. Each provider maintains independent conversation memory across turns.
3. Cross-feed sends each provider the other two latest outputs concurrently.
4. Streaming is visible per panel while responses generate.
5. Conversation history persists across reloads.
6. Single and bulk export both work without data deletion.
7. UI is usable on desktop and mobile.
8. User can view model choice, usage, and errors clearly.

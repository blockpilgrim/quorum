# Quorum: Multi-Model AI Workspace

## Problem

Comparing outputs across Claude, ChatGPT, and Gemini means copying the same prompt into three tabs... which is already tedius. And if you want to go a step further by having them challenge each other's thinking, that's even more friction. 

So I wanted a more practical solution, which could also work across devices. 

## What It Does

One input sends a prompt to all three models concurrently. Three streaming columns on desktop, stacked panels on mobile. Each model keeps its own independent conversation thread. Installable as an app on both.

Cross-feed: one tap sends each model's latest response to the other two as a new prompt. All three respond simultaneously. Can be repeated for multiple rounds — models build on and challenge each other across turns.

## How It Was Built

Built in one day using a playbook I've been developing for AI-native builds. The playbook structures three planning artifacts:

1. **Product spec** — features, acceptance criteria, UX requirements, scope boundaries
2. **Technical strategy** — stack, architecture, key decisions with documented tradeoffs
3. **Implementation plan** — 13 sequenced phases with dependency ordering and parallelization notes

These feed into a pipeline of six specialized AI agents — builder, test writer, code reviewer, doc verifier, documentation writer, refactor scout — orchestrated by a single `/implement` command. A quality gate enforces that every phase completes before a session ends.

Each of the 13 phases ran as one `/implement` session. Independent phases ran in parallel across multiple agent instances. 405 tests passing at ship.

## My Role

I did not write application code. Here's what I did instead:

- **The Spec:** Written with the precision of a TPM handoff, because that's exactly what it is. The agent is your team now. Ambiguity in the spec becomes bugs in the output.
- **The Architecture:** Every technical decision documented with explicit tradeoffs — not for posterity, but because agents need that context to make coherent downstream choices.
- **The System:** The agent pipeline is its own product. Scoped each agent's role, tooling access, and output contract. Tuned the quality gate so nothing ships without review.
- **The Sequencing:** Knowing what's safe to parallelize — and what isn't — is the difference between a one-day build and a one-day mess.

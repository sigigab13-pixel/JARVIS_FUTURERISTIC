# JARVIS Journey

This document is the public development journal for JARVIS.

The purpose is simple: record the real work as it happens.

Each entry should answer:

1. What did we build?
2. Why did we build it?
3. What changed technically?
4. What problem did we solve?
5. What remains?
6. What is the next milestone?

---

## Entry 001 — Rebuilding JARVIS as a real platform

**Status:** In progress

JARVIS is being rebuilt as a full AI platform rather than a single chatbot or a single-purpose content tool.

The architecture is moving toward a multi-cloud foundation using GitHub for source control, Vercel for the web application, Supabase for authentication and persistent data, Oracle Cloud for long-running workers, Cloudflare R2 for media storage, and Upstash Redis for queues and caching.

The product direction now includes business management, Brand Kits, persistent memory, Image Lab, Video Studio, voice, specialized offices, automation, Forest, subscriptions, analytics, repair/recovery and future integrations.

### Video Studio milestone

The Video Engine foundation now persists:

- video projects
- characters
- scenes
- production plans
- dialogue
- visual direction
- camera direction
- audio direction
- lip-sync plans
- continuity information

The Video Studio UI also has editable Character Bible and Scene Director workflows.

This matters because the goal is not to generate disconnected clips. JARVIS needs to understand a production as a structured project with reusable characters, worlds, scenes and continuity.

### Next

The next engineering work will continue turning these foundations into production execution:

- background video workers
- media storage
- generation adapters
- rendering
- QA
- recovery
- quotas
- publishing
- analytics

---

## Entry 002 — Building the JARVIS orchestration engine

**Status:** Implemented and tested on the development branch

The next major step was turning JARVIS from a collection of capabilities into an orchestrated system.

### What we built

JARVIS now has a central tool registry and execution layer for core capabilities including:

- system health checks
- persistent memory search
- image generation
- video planning
- chat generation

The `/api/jarvis` route acts as the orchestration entry point while preserving the existing capability routes.

### Autonomous planning

JARVIS can now build a validated execution plan for supported requests.

For example, a memory-aware request can be planned as:

1. search persistent memory
2. pass the relevant memory into chat generation

Explicit image and video requests are routed to their corresponding tools.

Plans are validated before execution, tool names are checked against the registry, execution results are verified, and retryable failures can be retried within bounded limits.

The execution engine also limits plan length so an unexpected request cannot create an unbounded chain of actions.

### Important fix

During testing, nested references to previous tool results were not being resolved correctly.

That was fixed so references such as nested previous outputs can now be resolved during plan execution.

### Verification

The development test suite currently passes all 6 orchestration tests, including:

- core tool registration
- image routing
- video project validation
- successful tool execution verification
- memory-to-chat autonomous planning
- rejection of unregistered tools

### What remains

The orchestration layer is still being expanded. The next infrastructure work is to connect queued jobs to durable workers, persist execution state, improve recovery, and continue integrating the multi-cloud services.

### Next milestone

**Phase 1D — Redis queue → durable worker → Supabase execution state.**

---

## Writing standard

Public updates should be honest about project status.

Do not claim a feature is deployed, production-ready, connected, or working unless it has actually been verified.

When a feature fails, document the failure and the fix. Those failures are part of the real engineering journey.


### Entry 003 — Durable worker heartbeat hardening

The JARVIS worker was hardened for long-running background jobs. Workers now refresh job heartbeats while processing so longer tasks can keep their execution lease alive. This prepares the system for future Oracle Cloud workers and longer video, memory, and automation jobs.

Development partner: GPT-5.6 Luna.

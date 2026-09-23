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

The journey will continue to be documented here as the system evolves.

---

## Writing standard

Public updates should be honest about project status.

Do not claim a feature is deployed, production-ready, connected, or working unless it has actually been verified.

When a feature fails, document the failure and the fix. Those failures are part of the real engineering journey.

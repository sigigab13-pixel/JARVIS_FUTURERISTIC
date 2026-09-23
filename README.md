# JARVIS — Futureristic AI Platform

> An independent AI platform being built by Saviour, with GPT-5.6 Luna as the AI development partner.

JARVIS is being built as a broader AI operating platform — not just a chatbot and not just a content generator. The long-term goal is to bring conversation, memory, business management, offices, automation, image generation, video production, voice, publishing, and reliability systems into one product.

## 🚀 What we are building

- 💬 AI conversation and command handling
- 🧠 Persistent memory and personalization
- 🔐 Google sign-in and authenticated user accounts
- 🏢 Business management and Brand Kit
- 🎙️ Voice/TTS with ElevenLabs
- 🖼️ Image Lab and image editing
- 🎬 Video Studio / Video Engine
- 🌲 Forest autonomous content-production system
- 🧰 Specialized JARVIS offices
- ⚙️ Background jobs, scheduling, repair and recovery
- 📊 Usage, plans and entitlements
- 🎨 User customization and branding
- 📣 Future publishing and analytics integrations
- ☁️ Multi-cloud architecture for scalable production

## 🏗️ Current architecture

JARVIS is being rebuilt around a multi-cloud foundation:

```text
GitHub
   │
   ├── Source control
   │
Vercel
   ├── Frontend / web application
   └── API deployment
        │
        ├──────── Supabase
        │          ├── Auth
        │          ├── PostgreSQL
        │          ├── Memory
        │          ├── Jobs / state
        │          └── Vector memory
        │
        ├──────── Oracle Cloud
        │          └── Long-running workers / rendering / automation
        │
        ├──────── Cloudflare R2
        │          └── Media/object storage
        │
        └──────── Upstash Redis
                   └── Queues / cache
```

Not every planned cloud component is connected yet. The repository is being developed toward this architecture incrementally.

## 🎬 Video Engine

The Video Engine is being built as a real production pipeline rather than a simple slideshow generator.

Its architecture includes:

- Story Director
- Character Bible
- Outfit Engine
- World / Asset Bible
- Scene Director
- Storyboard / Cost Gate
- Visual Generation
- Motion Engine
- Voice / Audio
- Lip-sync
- Editing / transitions
- Localization
- Subtitles
- Preview
- A/B variations
- Continuity and Brand QA
- Repair / recovery
- Change Manager
- Asset cache / reuse
- Prompt memory
- Resource / quota management
- Rendering
- Aspect-ratio adaptation
- Final QA
- Versioning
- Metadata / thumbnails
- Publishing
- Performance memory

The current repository already contains the foundation for persistent video projects, characters, assets and scenes, plus Video Studio editing and production-planning flows.

## 💼 Business platform

JARVIS is also being designed to help users manage businesses:

- Business profile
- Products and services
- Customers
- Projects and tasks
- Documents
- Business knowledge
- Brand Kit
- Marketing workflows
- Content calendars
- Reports and analytics
- Automation
- Specialized AI offices

The Brand Kit is intended to become a shared source of truth for generated images, videos, documents and marketing content.

## 💰 Product direction

The intended business model includes free and paid plans with different access levels, generation allowances and advanced capabilities.

Planned premium capabilities include advanced video, larger image allowances, advanced offices, automation, customization, API access and other business features.

Prices and limits are subject to change as real operating costs and user demand become clearer.

## 🌲 Forest

Forest sits above the production engines as an autonomous content/business workflow.

The planned loop is:

```text
Research
  ↓
Trend detection
  ↓
Story / content planning
  ↓
Production
  ↓
Quality control
  ↓
Approval
  ↓
Publishing
  ↓
Analytics
  ↓
Learning
  ↺
```

Forest is one part of JARVIS, not the entire product.

## 🔐 Security

Sensitive credentials belong in deployment environment variables or managed secrets.

Never commit:

- API keys
- OAuth client secrets
- access/refresh tokens
- passwords
- private keys
- database secrets

The public repository should contain source code and documentation, not private credentials.

## 📖 Build in public

This project is being built publicly so people can follow the real journey.

Every major milestone can become:

- a development journal entry
- a technical write-up
- a social-media update
- a short-video script
- a GitHub milestone
- a launch/update announcement

The goal is to document what was actually built, what failed, what was fixed, and what comes next.

See [docs/JOURNEY.md](docs/JOURNEY.md).

## 🤝 Support JARVIS

You can support the project without spending money:

- ⭐ Star the repository
- Share the project
- Test features
- Report bugs
- Suggest improvements
- Review the architecture
- Contribute documentation or code

Development is being done with limited hardware, so legitimate support such as development hardware, cloud resources, storage, or AI/API credits can also help the project progress.

## 👤 Creator

**Saviour** — Creator and developer of JARVIS.

**GPT-5.6 Luna** — AI development partner helping build, debug, document and evolve the platform.

> **JARVIS is being built in public — one capability at a time.**

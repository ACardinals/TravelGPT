# Project TravelGPT: TODO & Future Roadmap

**[English](./TODO.md) | [简体中文](./TODO_zh-CN.md)**

This document outlines the remaining tasks required to take the TravelGPT project from its current state to a full production launch. This serves as a checklist for when development resumes.

---

## Phase 1: Cloud Infrastructure Migration (Highest Priority for Deployment)

The current setup uses local-only databases (SQLite, local vector store), which must be migrated to cloud services for production.

-   [ ] **Migrate Relational Database to PostgreSQL:**
    -   [ ] Choose a cloud provider (Vercel Postgres is recommended for Vercel deployments, Supabase or Neon are great alternatives).
    -   [ ] Create a new PostgreSQL database instance and obtain the connection string (`DATABASE_URL`).
    -   [ ] Add the `DATABASE_URL` to the `.env` file and to Vercel's environment variables.
    -   [ ] The `prisma/schema.prisma` file has already been configured for `postgresql`.
    -   [ ] Run `npx prisma db push` to synchronize the schema with the new cloud database.

-   [ ] **Migrate Vector Database to a Cloud Service:**
    -   [ ] The current `vectorDBService.ts` is likely using a local or in-memory solution. This needs to be production-ready.
    -   [ ] Choose a managed vector database provider (e.g., Pinecone, Zilliz Cloud, or Supabase with pgvector).
    -   [ ] Create a new vector database/index and get the required API keys and environment URLs.
    -   [ ] Update `src/server/services/vectorDBService.ts` and `embeddingService.ts` to connect to the cloud provider.
    -   [ ] Add the necessary API keys (e.g., `PINECONE_API_KEY`) to `.env` and Vercel's environment variables.

---

## Phase 2: Data Pipeline for RAG Knowledge Base

The RAG system's effectiveness depends on the quality and freshness of its knowledge base.

-   [ ] **Finalize Data Scraping Scripts:**
    -   [ ] Review and test the `scraper.ts` to ensure it reliably collects high-quality data.
    -   [ ] Implement robust error handling and potentially a mechanism to avoid re-scraping the same content.

-   [ ] **Create and Run Production Seeding Script:**
    -   [ ] Create a one-off script (e.g., `scripts/seed-vector-db.ts`) that:
        1.  Reads the collected raw data.
        2.  Uses the `embeddingService` to generate vectors.
        3.  Uses the production `vectorDBService` to upload and index these vectors into the cloud vector database.
    -   [ ] This script must be run once to populate the production knowledge base before launch.

---

## Phase 3: Frontend Feature Development

The backend has advanced features that are not yet exposed on the frontend.

-   [ ] **Build the Conversational Assistant UI:**
    -   [ ] The `chatWithPlanAssistant` tRPC endpoint is fully functional, but there is no UI for it.
    -   [ ] On the plan details page (`/my-plans/[planId]`), add a new component for a chat interface.
    -   [ ] This interface should include:
        -   A message display area to show conversation history (from `getConversationHistory`).
        -   A text input field for the user to type new messages.
        -   A "Send" button that triggers the `chatWithPlanAssistant` mutation.
        -   Loading states to indicate when the assistant is "thinking".
        -   Real-time updates of the conversation history as new messages are sent and received.

---

## Phase 4: Production Readiness & Optimization

Final steps to ensure the application is robust, secure, and performant.

-   [ ] **Implement Comprehensive Logging & Error Monitoring:**
    -   [ ] Integrate a logging service (e.g., Logtail, Sentry) to capture backend errors and important events, especially from the AI services.

-   [ ] **Security Hardening:**
    -   [ ] Review all database queries and user inputs for potential security vulnerabilities.
    -   [ ] Consider adding rate limiting to the AI-intensive endpoints (`analyzePlan`, `chatWithPlanAssistant`) to prevent abuse.

-   [ ] **Performance Optimization:**
    -   [ ] Optimize image loading and rendering.
    -   [ ] Review component rendering to minimize unnecessary re-renders.

-   [ ] **Final Deployment to Vercel:**
    -   [ ] Double-check that all production environment variables are set in the Vercel project dashboard.
    -   [ ] Trigger a final production deployment from the `main` branch.
    -   [ ] Thoroughly test all application features on the live production URL. 
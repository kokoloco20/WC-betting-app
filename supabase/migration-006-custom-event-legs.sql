-- Migration 006 — run once in the Supabase SQL editor (safe to re-run).
-- Lets a leg describe a non-World-Cup event (darts, tennis, …) as free text.

alter table legs add column if not exists custom_event text;

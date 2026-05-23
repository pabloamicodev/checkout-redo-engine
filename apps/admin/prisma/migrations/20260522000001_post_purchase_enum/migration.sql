-- MarginLab: Add POST_PURCHASE to PersonalizationType enum
-- This migration documents the addition of POST_PURCHASE support.
-- The value was included in the initial schema; this migration is recorded
-- so that environments that were set up between schema versions are upgraded.

ALTER TYPE "PersonalizationType" ADD VALUE IF NOT EXISTS 'POST_PURCHASE';

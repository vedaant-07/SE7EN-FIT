# Phase 5 canonical data contract

## AI Coach

One authenticated request creates at most one user row and one assistant row for a `(user_id, request_id)` pair. Usage is reserved before the provider call and marked succeeded or failed afterward.

## Food Scan

The analysis result is stored separately from the nutrition diary. User corrections are confirmed through one database transaction that writes all diary rows and marks the scan confirmed.

## Workout plan

A member has one active personalized plan. New generation archives the previous plan. Completion links a plan session to one workout log using an idempotent external identifier.

## Daily overview

Cumulative health-provider step snapshots use the maximum daily value. Unique live-tracking sessions are deduplicated by external identifier. Manual additions remain additive. Cardio and workouts are deduplicated by their external or plan-session identifiers.

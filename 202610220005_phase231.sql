-- Phase 2.3.1. Actual tutorial completion, including existing accounts.
begin;
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
-- Version 2.3 inferred completion from an existing bank account, without an audit
-- marker. Offer the guide once to these profiles; preserve ongoing/deferred guides.
-- Genuine completions made in 2.3 cannot be distinguished from that inference.
update public.profiles set onboarding_step=0
where onboarding_step=4 and not onboarding_dismissed and onboarding_completed_at is null;
commit;

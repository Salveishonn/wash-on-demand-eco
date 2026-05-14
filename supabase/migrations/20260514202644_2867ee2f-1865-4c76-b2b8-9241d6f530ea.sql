create table if not exists public.botmaker_events (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  event_type text not null default 'unknown',
  channel text,
  sender_type text,
  conversation_id text,
  customer_phone text,
  customer_name text,
  message_text text,
  auth_valid boolean,
  payload jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processing_error text,
  communication_provider text default 'botmaker',
  created_at timestamptz not null default now()
);

alter table public.botmaker_events enable row level security;

alter table public.botmaker_events add column if not exists sender_type text;
alter table public.botmaker_events add column if not exists message_text text;
alter table public.botmaker_events add column if not exists auth_valid boolean;
alter table public.botmaker_events add column if not exists raw_payload jsonb not null default '{}'::jsonb;

update public.botmaker_events
set raw_payload = payload
where raw_payload = '{}'::jsonb and payload is not null;

create table if not exists public.botmaker_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null unique,
  botmaker_conversation_id text,
  customer_phone text,
  customer_name text,
  channel text default 'whatsapp',
  last_message text,
  last_message_preview text,
  last_message_at timestamptz default now(),
  last_direction text,
  last_sender_type text,
  linked_customer_id uuid,
  linked_booking_request_id uuid,
  linked_booking_id uuid,
  raw_payload jsonb not null default '{}'::jsonb,
  unread_count integer not null default 0,
  communication_provider text not null default 'botmaker',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.botmaker_conversations enable row level security;

alter table public.botmaker_conversations add column if not exists botmaker_conversation_id text;
alter table public.botmaker_conversations add column if not exists last_message text;
alter table public.botmaker_conversations add column if not exists raw_payload jsonb not null default '{}'::jsonb;

update public.botmaker_conversations
set botmaker_conversation_id = conversation_id
where botmaker_conversation_id is null;

update public.botmaker_conversations
set last_message = last_message_preview
where last_message is null and last_message_preview is not null;

create unique index if not exists idx_botmaker_conversations_conversation_id on public.botmaker_conversations(conversation_id);
create index if not exists idx_botmaker_conversations_botmaker_conversation_id on public.botmaker_conversations(botmaker_conversation_id);

create table if not exists public.botmaker_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  botmaker_message_id text,
  provider_message_id text,
  direction text not null,
  sender text,
  sender_type text,
  message_type text,
  body text,
  message_text text,
  customer_phone text,
  customer_name text,
  channel text,
  raw jsonb default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  event_timestamp timestamptz,
  communication_provider text not null default 'botmaker',
  created_at timestamptz not null default now()
);

alter table public.botmaker_messages enable row level security;

alter table public.botmaker_messages add column if not exists botmaker_message_id text;
alter table public.botmaker_messages add column if not exists sender_type text;
alter table public.botmaker_messages add column if not exists message_text text;
alter table public.botmaker_messages add column if not exists customer_phone text;
alter table public.botmaker_messages add column if not exists customer_name text;
alter table public.botmaker_messages add column if not exists channel text;
alter table public.botmaker_messages add column if not exists raw_payload jsonb not null default '{}'::jsonb;

update public.botmaker_messages
set message_text = body
where message_text is null and body is not null;

update public.botmaker_messages
set raw_payload = raw
where raw_payload = '{}'::jsonb and raw is not null;

create index if not exists idx_botmaker_messages_conversation_created on public.botmaker_messages(conversation_id, created_at desc);
create unique index if not exists idx_botmaker_messages_conv_provider_msg on public.botmaker_messages(conversation_id, provider_message_id) where provider_message_id is not null;
create unique index if not exists idx_botmaker_messages_conv_bm_msg on public.botmaker_messages(conversation_id, botmaker_message_id) where botmaker_message_id is not null;

create table if not exists public.botmaker_diagnostics (
  key text primary key,
  value_at timestamptz,
  value_text text,
  updated_at timestamptz not null default now()
);

alter table public.botmaker_diagnostics enable row level security;

create index if not exists idx_botmaker_events_created_at on public.botmaker_events(created_at desc);
create index if not exists idx_botmaker_events_conversation_id on public.botmaker_events(conversation_id);

do $$ begin
  create policy "Admins can view botmaker events" on public.botmaker_events for select using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Service role can insert botmaker events" on public.botmaker_events for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Service role can update botmaker events" on public.botmaker_events for update using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins can view botmaker conversations" on public.botmaker_conversations for select using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Service role manages botmaker conversations insert" on public.botmaker_conversations for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Service role manages botmaker conversations update" on public.botmaker_conversations for update using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins can view botmaker messages" on public.botmaker_messages for select using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Service role inserts botmaker messages" on public.botmaker_messages for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins can read diagnostics" on public.botmaker_diagnostics for select using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Service role manages diagnostics insert" on public.botmaker_diagnostics for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Service role manages diagnostics update" on public.botmaker_diagnostics for update using (true);
exception when duplicate_object then null; end $$;
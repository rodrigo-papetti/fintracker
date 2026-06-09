-- Run this entire file in Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- Settings table (one row, stores categories + watchlist + base currency)
create table if not exists settings (
  id integer primary key default 1,
  base_currency text not null default 'USD',
  categories jsonb not null default '[
    {"id":"bonds","name":"Bonds","color":"#2563eb"},
    {"id":"equity","name":"Equity","color":"#0f9e80"},
    {"id":"crypto","name":"Crypto","color":"#c47a1a"},
    {"id":"real_estate","name":"Real estate","color":"#7c3aed"},
    {"id":"cash","name":"Cash","color":"#8a8a85"}
  ]',
  watchlist jsonb not null default '[
    {"id":"us10y","name":"US 10Y Treasury","source":"FRED","symbol":"DGS10","type":"macro"},
    {"id":"sp500","name":"S&P 500","source":"Yahoo","symbol":"^GSPC","type":"index"},
    {"id":"nasdaq","name":"Nasdaq","source":"Yahoo","symbol":"^IXIC","type":"index"},
    {"id":"btc","name":"Bitcoin (BTC)","source":"CoinGecko","symbol":"bitcoin","type":"crypto"},
    {"id":"usdbrl","name":"USD/BRL","source":"Yahoo","symbol":"BRL=X","type":"fx"},
    {"id":"usdkrw","name":"USD/KRW","source":"Yahoo","symbol":"KRW=X","type":"fx"},
    {"id":"cpi","name":"US CPI","source":"FRED","symbol":"CPIAUCSL","type":"macro"}
  ]',
  updated_at timestamptz default now()
);

-- Insert default settings row
insert into settings (id) values (1) on conflict (id) do nothing;

-- Assets table
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  currency text not null default 'USD',
  institution text,
  current_value numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Asset value history (one row per asset per update session)
create table if not exists asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id) on delete cascade,
  value numeric not null,
  recorded_at date not null default current_date
);

-- Net worth snapshots (one row per update session)
create table if not exists networth_history (
  id uuid primary key default gen_random_uuid(),
  value numeric not null,
  recorded_at date not null default current_date
);

-- Briefing cache (stores last generated briefing)
create table if not exists briefing_cache (
  id integer primary key default 1,
  data jsonb,
  generated_at timestamptz default now()
);

insert into briefing_cache (id) values (1) on conflict (id) do nothing;

-- Seed sample assets (delete these after setup and add your own via the app)
insert into assets (name, category, currency, institution, current_value) values
  ('US Treasury Bonds',   'bonds',       'USD', 'Fidelity',  312000),
  ('S&P 500 Index Fund',  'equity',      'USD', 'Fidelity',  184500),
  ('AI / Tech ETF',       'equity',      'USD', 'Schwab',    97800),
  ('Bitcoin',             'crypto',      'USD', 'Coinbase',  44200),
  ('São Paulo apartment', 'real_estate', 'BRL', 'Manual',    772000),
  ('Coupang RSUs',        'equity',      'USD', 'Manual',    51800),
  ('KRW savings',         'cash',        'KRW', 'KB Bank',   23490000);

// Databaseskema. Køres ved opstart (CREATE ... IF NOT EXISTS), så det virker både
// på den lokale PGlite-database og på Supabase Postgres.
export const SCHEMA = `
create table if not exists settings (
  key text primary key,
  value text not null
);

create table if not exists seasons (
  id serial primary key,
  name text not null,
  order_deadline timestamptz,
  choose_deadline timestamptz,
  dropoff_deadline timestamptz,
  delivery_from timestamptz,
  active boolean not null default true,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists price_categories (
  id serial primary key,
  name text not null,
  value_kr integer not null,
  note text,
  sort integer not null default 0
);

create table if not exists shops (
  id serial primary key,
  name text not null,
  cvr text,
  address text,
  town text,
  contact_name text,
  phone text,
  email text,
  story text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists companies (
  id serial primary key,
  name text not null,
  cvr text,
  address text,
  town text,
  contact_name text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id serial primary key,
  email text not null unique,
  password_hash text not null,
  name text,
  role text not null check (role in ('admin','butik','virksomhed','logistik')),
  shop_id integer references shops(id) on delete cascade,
  company_id integer references companies(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id integer not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists products (
  id serial primary key,
  shop_id integer not null references shops(id) on delete cascade,
  name text not null,
  description text not null default '',
  kind text not null,
  price_category_id integer references price_categories(id),
  normal_price_kr integer,
  stock integer not null default 0,
  alcohol boolean not null default false,
  images text not null default '[]',
  status text not null default 'draft',
  review_note text,
  cost_kr integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists gift_orders (
  id serial primary key,
  company_id integer not null references companies(id) on delete cascade,
  season_id integer not null references seasons(id),
  price_category_id integer not null references price_categories(id),
  title text not null,
  greeting text,
  default_product_id integer references products(id),
  status text not null default 'draft',
  delivery_address text,
  delivery_contact text,
  delivery_note text,
  confirmed_at timestamptz,
  invited_at timestamptz,
  packed_at timestamptz,
  delivered_at timestamptz,
  delivered_to text,
  created_at timestamptz not null default now()
);

create table if not exists handoffs (
  id serial primary key,
  shop_id integer not null references shops(id) on delete cascade,
  season_id integer not null references seasons(id),
  code text not null unique,
  created_at timestamptz not null default now(),
  handed_at timestamptz,
  received_at timestamptz
);

create table if not exists recipients (
  id serial primary key,
  order_id integer not null references gift_orders(id) on delete cascade,
  name text not null,
  email text not null,
  department text,
  token text not null unique,
  invited_at timestamptz,
  opened_at timestamptz,
  reminded_at timestamptz,
  age_confirmed boolean not null default false,
  chosen_product_id integer references products(id),
  chosen_at timestamptz,
  is_default boolean not null default false,
  handoff_id integer references handoffs(id),
  received_at timestamptz,
  missing boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists password_resets (
  token text primary key,
  user_id integer not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists outbox (
  id serial primary key,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'gemt',
  created_at timestamptz not null default now()
);

create table if not exists events (
  id serial primary key,
  at timestamptz not null default now(),
  actor text,
  entity text not null,
  entity_id integer,
  action text not null,
  detail text
);

-- Bestillinger fra virksomheder (kassen). Én bestilling kan have flere prisgrupper (gift_orders).
create table if not exists purchases (
  id serial primary key,
  company_id integer not null references companies(id) on delete cascade,
  status text not null default 'new',
  delivery_mode text not null default 'company' check (delivery_mode in ('company','home')),
  delivery_week text not null,
  delivery_date date not null,
  choose_deadline timestamptz not null,
  wrapping boolean not null default false,
  codes_delivery text not null default 'email' check (codes_delivery in ('email','file')),
  payment text not null default 'faktura' check (payment in ('faktura','ean','kort')),
  ean text,
  po_number text,
  cvr text,
  company_name text not null,
  billing_address text not null,
  billing_zip text not null,
  billing_city text not null,
  billing_country text not null default 'Danmark',
  billing_email text not null,
  delivery_same boolean not null default true,
  delivery_name text,
  delivery_address text,
  delivery_zip text,
  delivery_city text,
  delivery_att text,
  contact_first text not null,
  contact_last text not null,
  contact_email text not null,
  contact_phone text not null,
  newsletter boolean not null default false,
  quantity integer not null,
  subtotal_ex integer not null,
  delivery_fee_ex integer not null default 0,
  wrapping_fee_ex integer not null default 0,
  moms integer not null,
  total_inc integer not null,
  invoiced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table shops add column if not exists logo text;
alter table shops add column if not exists website text;
alter table gift_orders add column if not exists purchase_id integer references purchases(id) on delete cascade;
alter table gift_orders add column if not exists quantity integer;
alter table gift_orders add column if not exists choose_deadline timestamptz;
alter table gift_orders add column if not exists delivery_date date;
alter table gift_orders add column if not exists delivery_mode text not null default 'company';
alter table gift_orders add column if not exists wrapping boolean not null default false;

alter table recipients alter column name drop not null;
alter table recipients alter column email drop not null;
alter table recipients add column if not exists code text unique;
alter table recipients add column if not exists address text;
alter table recipients add column if not exists zip text;
alter table recipients add column if not exists city text;
alter table recipients add column if not exists phone text;

alter table handoffs add column if not exists dropoff_deadline timestamptz;

alter table products add column if not exists ingredients text;
alter table products add column if not exists net_content text;
alter table products add column if not exists wrap_ok boolean not null default false;
alter table products add column if not exists shelf_ok boolean not null default false;

create index if not exists recipients_order_idx on recipients(order_id);
create index if not exists gift_orders_purchase_idx on gift_orders(purchase_id);
create index if not exists recipients_product_idx on recipients(chosen_product_id);
create index if not exists products_shop_idx on products(shop_id);
`;

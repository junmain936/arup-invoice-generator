-- Supabase SQL Editor mein yeh run karo
-- arup-invoice-generator project ke liye

create table invoices (
  id uuid default gen_random_uuid() primary key,
  invoice_no text not null unique,
  invoice_date date not null,
  due_date date,
  billed_by jsonb not null,
  billed_to jsonb not null,
  items jsonb not null,
  gst_type text default 'intra',
  subtotal numeric(12,2),
  total_gst numeric(12,2),
  grand_total numeric(12,2),
  currency text default '₹',
  created_at timestamptz default now()
);

-- Index for faster queries
create index idx_invoices_date on invoices(invoice_date desc);
create index idx_invoices_no on invoices(invoice_no);

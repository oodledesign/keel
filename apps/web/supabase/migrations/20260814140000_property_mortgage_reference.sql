-- Add optional mortgage account / reference number on properties.
alter table public.properties
  add column if not exists mortgage_reference text;

comment on column public.properties.mortgage_reference is
  'Lender account or mortgage reference number for this property.';

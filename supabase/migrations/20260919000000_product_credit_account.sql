-- Per-product bank account members should pay into for external-payment funding.
alter table products
  add column credit_account_info text;

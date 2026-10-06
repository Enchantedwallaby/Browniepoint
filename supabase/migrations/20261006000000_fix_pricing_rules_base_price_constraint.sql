-- ====================================================================
-- BROWNIE POINT OPERATIONS SYSTEM - UPDATE PRICING RULES CONSTRAINT
-- Migration Version: 20261006000000_fix_pricing_rules_base_price_constraint.sql
-- Description: Updates chk_pricing_base_price constraint to allow NULL
--              base_price (for products with no selling price)
--              and enforces base_price >= 0 when a price is provided.
-- ====================================================================

-- 1. Drop existing constraint if it exists
ALTER TABLE public.pricing_rules
DROP CONSTRAINT IF EXISTS chk_pricing_base_price;

-- Drop auto-named inline check if present
ALTER TABLE public.pricing_rules
DROP CONSTRAINT IF EXISTS pricing_rules_base_price_check;

-- 2. Add updated constraint allowing NULL base_price or base_price >= 0
ALTER TABLE public.pricing_rules
ADD CONSTRAINT chk_pricing_base_price
CHECK (base_price IS NULL OR base_price >= 0);

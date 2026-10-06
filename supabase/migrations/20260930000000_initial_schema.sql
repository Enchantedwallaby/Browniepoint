-- ====================================================================
-- BROWNIE POINT OPERATIONS SYSTEM - DATABASE FOUNDATION MIGRATION
-- Migration Version: 20260930000000_initial_schema.sql
-- Description: Core tables, enums, integrity constraints, indexes,
--              FEFO inventory views, sales history, order tracking,
--              and secure Row Level Security (RLS).
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('OWNER', 'MAIN_BRANCH_EMPLOYEE', 'BRANCH_EMPLOYEE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.branch_type AS ENUM ('MAIN', 'SUB_BRANCH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.product_category AS ENUM (
    'Cakes',
    'Pastries',
    'Brownies',
    'Macarons',
    'Cup Cakes',
    'Desserts',
    'Cheese Cakes',
    'Sugar Free Cakes',
    'Tea-Time Cakes',
    'Cookies',
    'Savouries',
    'Packaging',
    'Utensils',
    'Consumables',
    'Other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.quantity_unit AS ENUM (
    'PIECE',
    'KG',
    'HALF_KG',
    'GRAM',
    'BOX',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.pricing_type AS ENUM (
    'FIXED_PER_UNIT',
    'WEIGHT_VARIANT',
    'PER_KG',
    'CUSTOM'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_movement_type AS ENUM (
    'PRODUCTION',
    'SALE',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'RETURN_OUT',
    'RETURN_IN',
    'EXPIRED',
    'DAMAGED',
    'ADJUSTMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM (
    'CASH',
    'ONLINE',
    'CARD',
    'UPI',
    'MIXED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sale_status AS ENUM (
    'COMPLETED',
    'RETURNED',
    'VOIDED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'IN_PRODUCTION',
    'READY',
    'DELIVERED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


-- 3. CORE TABLES

-- Table 1: Branches
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  branch_code TEXT NOT NULL UNIQUE,
  branch_type public.branch_type NOT NULL DEFAULT 'SUB_BRANCH',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 2: Profiles (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role public.user_role NOT NULL DEFAULT 'BRANCH_EMPLOYEE',
  branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 3: Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category public.product_category NOT NULL DEFAULT 'Other',
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 4: Product Variants
-- Supports half-kg, 1-kg, per-piece etc. variants per product.
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity_value NUMERIC NOT NULL DEFAULT 1 CHECK (quantity_value > 0),
  quantity_unit public.quantity_unit NOT NULL DEFAULT 'PIECE',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 5: Pricing Rules
-- STANDARD MENU PRICE: pricing_type IN ('FIXED_PER_UNIT','WEIGHT_VARIANT','PER_KG') — base_price is mandatory.
-- CUSTOM PRICE:        pricing_type = 'CUSTOM' — base_price is NULL; price entered per-order/per-sale.
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  pricing_type public.pricing_type NOT NULL DEFAULT 'FIXED_PER_UNIT',
  base_price NUMERIC CHECK (base_price IS NULL OR base_price >= 0),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_pricing_base_price CHECK (
    pricing_type = 'CUSTOM' OR base_price IS NOT NULL
  )
);

-- Table 6: Product Batches (Expiry tracking per batch, not per product)
CREATE TABLE IF NOT EXISTS public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  initial_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (initial_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_variant_batch_number UNIQUE (product_variant_id, batch_number),
  CONSTRAINT chk_expiry_after_production CHECK (expiry_date >= production_date)
);

-- Table 7: Inventory (Branch-specific, Variant-specific, Batch-aware)
-- quantity_available: ready to sell at this branch
-- quantity_in_transit: dispatched from Main Branch, not yet received at destination
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE CASCADE,
  quantity_available NUMERIC NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  quantity_in_transit NUMERIC NOT NULL DEFAULT 0 CHECK (quantity_in_transit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_branch_variant_batch UNIQUE (branch_id, product_variant_id, batch_id)
);

-- Table 8: Inventory Movements (Auditable, append-only history)
-- All stock changes MUST go through this table. Never silently overwrite inventory.
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  movement_type public.inventory_movement_type NOT NULL,
  quantity NUMERIC NOT NULL,
  reference_type TEXT,       -- e.g. 'sale', 'order', 'transfer'
  reference_id UUID,         -- FK to sales.id or orders.id (soft reference for flexibility)
  notes TEXT,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 9: Sales
-- Records each completed sales transaction at a branch.
-- unit_price_snapshot: The EXACT price charged at time of sale — immutable after insert.
-- For standard menu items: unit_price_snapshot is populated from pricing_rules.base_price.
-- For custom items: unit_price_snapshot is manually entered by employee.
-- Historical sales are NEVER affected by future pricing rule changes.
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_amount NUMERIC NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  payment_method public.payment_method NOT NULL DEFAULT 'CASH',
  amount_cash NUMERIC NOT NULL DEFAULT 0 CHECK (amount_cash >= 0),
  amount_online NUMERIC NOT NULL DEFAULT 0 CHECK (amount_online >= 0),
  customer_name TEXT,        -- optional, used for custom cakes / named orders
  notes TEXT,
  status public.sale_status NOT NULL DEFAULT 'COMPLETED',
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id UUID,             -- FK to orders.id if this sale is linked to a custom cake order
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 10: Sale Items
-- Each line item within a sale.
-- unit_price_snapshot is locked at the time of sale — never changes.
-- is_custom_price: TRUE if employee manually entered the price (custom cakes).
-- custom_price_entered_by: who typed the custom price.
-- custom_price_entered_at: when it was entered (audit trail).
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price_snapshot NUMERIC NOT NULL CHECK (unit_price_snapshot >= 0),
  line_total NUMERIC GENERATED ALWAYS AS (quantity * unit_price_snapshot) STORED,
  is_custom_price BOOLEAN NOT NULL DEFAULT false,
  custom_price_entered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  custom_price_entered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 11: Orders (Custom Cake Orders & Advance Orders)
-- Stores the full detail of a custom or advance order.
-- For custom cakes: design_notes, quoted_price is the agreed selling price.
-- quoted_price_entered_by: who entered the custom price.
-- deposit_paid: advance deposit received from customer.
-- The quoted_price is locked on confirmation — it cannot change retroactively.
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  is_custom_cake BOOLEAN NOT NULL DEFAULT false,
  design_notes TEXT,         -- design, flavour, decoration instructions for custom cakes
  quoted_price NUMERIC CHECK (quoted_price IS NULL OR quoted_price >= 0),
  quoted_price_entered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  quoted_price_entered_at TIMESTAMPTZ,
  deposit_paid NUMERIC NOT NULL DEFAULT 0 CHECK (deposit_paid >= 0),
  delivery_date DATE,
  status public.order_status NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_order_number UNIQUE (branch_id, order_number)
);

-- Back-fill the soft FK from sales to orders
ALTER TABLE public.sales
  ADD CONSTRAINT fk_sales_order_id
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


-- 4. INDEXES FOR HIGH-PERFORMANCE QUERIES
CREATE INDEX IF NOT EXISTS idx_profiles_branch       ON public.profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role         ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_variant ON public.pricing_rules(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_batches_variant       ON public.product_batches(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry        ON public.product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup      ON public.inventory(branch_id, product_variant_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_fefo        ON public.inventory(branch_id, product_variant_id, quantity_available);
CREATE INDEX IF NOT EXISTS idx_movements_lookup      ON public.inventory_movements(branch_id, product_variant_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_movements_performed   ON public.inventory_movements(performed_by);
CREATE INDEX IF NOT EXISTS idx_sales_branch_date     ON public.sales(branch_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_performed       ON public.sales(performed_by);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale       ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant    ON public.sale_items(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_date    ON public.orders(branch_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_by     ON public.orders(created_by);


-- 5. FEFO INVENTORY VIEW (FIRST EXPIRY, FIRST OUT)
-- Returns available stock ordered by earliest expiry date — never merge different batches.
CREATE OR REPLACE VIEW public.v_fefo_inventory AS
SELECT
  i.id AS inventory_id,
  i.branch_id,
  b.name AS branch_name,
  b.branch_code,
  i.product_variant_id,
  pv.name AS variant_name,
  pv.quantity_value,
  pv.quantity_unit,
  pv.product_id,
  p.name AS product_name,
  p.category AS product_category,
  i.batch_id,
  pb.batch_number,
  pb.production_date,
  pb.expiry_date,
  i.quantity_available,
  i.quantity_in_transit,
  (pb.expiry_date <= CURRENT_DATE) AS is_expired,
  (pb.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM public.inventory i
JOIN public.branches b         ON b.id = i.branch_id
JOIN public.product_variants pv ON pv.id = i.product_variant_id
JOIN public.products p          ON p.id = pv.product_id
JOIN public.product_batches pb  ON pb.id = i.batch_id
WHERE i.quantity_available > 0
ORDER BY pb.expiry_date ASC, pb.created_at ASC;


-- 6. DAILY SALES SUMMARY VIEW
-- Powers daily sales reports per branch — total, cash, online breakdown.
CREATE OR REPLACE VIEW public.v_daily_sales_summary AS
SELECT
  s.branch_id,
  b.name AS branch_name,
  b.branch_code,
  s.sale_date::date AS sale_date,
  COUNT(s.id) AS total_transactions,
  SUM(s.total_amount) AS total_revenue,
  SUM(s.amount_cash) AS total_cash,
  SUM(s.amount_online) AS total_online,
  COUNT(si.id) AS total_items_sold
FROM public.sales s
JOIN public.branches b ON b.id = s.branch_id
JOIN public.sale_items si ON si.sale_id = s.id
WHERE s.status = 'COMPLETED'
GROUP BY s.branch_id, b.name, b.branch_code, s.sale_date::date
ORDER BY s.sale_date::date DESC, b.name;


-- 7. AUTOMATIC UPDATED_AT TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_product_batches_updated_at
  BEFORE UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 8. SECURE AUTHENTICATION TRIGGER & PROFILE PROTECTION
-- All new signups are created as BRANCH_EMPLOYEE with branch_id = NULL.
-- Users CANNOT self-assign OWNER or change their own branch_id.
-- Only the Owner can assign roles and branches via the Owner update policy.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, branch_id, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'BRANCH_EMPLOYEE'::public.user_role,
    NULL,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 9. SECURITY HELPER FUNCTIONS (SECURITY DEFINER — cannot be spoofed by client)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid() AND active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'OWNER'::public.user_role AND active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- 10. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.branches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders            ENABLE ROW LEVEL SECURITY;

-- --- BRANCHES ---
CREATE POLICY "branches_select_authenticated"
  ON public.branches FOR SELECT TO authenticated
  USING (active = true OR public.is_owner());

CREATE POLICY "branches_all_owner"
  ON public.branches FOR ALL TO authenticated
  USING (public.is_owner());

-- --- PROFILES ---
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_owner());

CREATE POLICY "profiles_insert_owner"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_owner());

-- Users can only update their own display name.
-- They cannot change their own role or branch_id.
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_owner())
  WITH CHECK (
    public.is_owner() OR (
      id = auth.uid() AND
      role = public.get_auth_role() AND
      (branch_id IS NOT DISTINCT FROM public.get_auth_branch_id())
    )
  );

-- --- PRODUCTS ---
CREATE POLICY "products_select"
  ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "products_write_owner_or_main"
  ON public.products FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE');

-- --- PRODUCT VARIANTS ---
CREATE POLICY "variants_select"
  ON public.product_variants FOR SELECT TO authenticated USING (true);

CREATE POLICY "variants_write_owner_or_main"
  ON public.product_variants FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE');

-- --- PRICING RULES ---
CREATE POLICY "pricing_select"
  ON public.pricing_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "pricing_write_owner_or_main"
  ON public.pricing_rules FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE');

-- --- PRODUCT BATCHES ---
CREATE POLICY "batches_select"
  ON public.product_batches FOR SELECT TO authenticated USING (true);

CREATE POLICY "batches_write_owner_or_main"
  ON public.product_batches FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE');

-- --- INVENTORY ---
-- Branch employees see only their assigned branch.
-- Main Branch employees and Owner see all branches.
CREATE POLICY "inventory_select"
  ON public.inventory FOR SELECT TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  );

CREATE POLICY "inventory_write"
  ON public.inventory FOR ALL TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  )
  WITH CHECK (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  );

-- --- INVENTORY MOVEMENTS (append-only audit) ---
CREATE POLICY "movements_select"
  ON public.inventory_movements FOR SELECT TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  );

CREATE POLICY "movements_insert"
  ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  );

-- --- SALES ---
-- Branch employees can create & view sales at their own branch only.
-- Owner and Main Branch Employee see all branches.
CREATE POLICY "sales_select"
  ON public.sales FOR SELECT TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  );

CREATE POLICY "sales_insert"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  );

CREATE POLICY "sales_update_owner_or_main"
  ON public.sales FOR UPDATE TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE'
  );

-- --- SALE ITEMS ---
CREATE POLICY "sale_items_select"
  ON public.sale_items FOR SELECT TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.branch_id = public.get_auth_branch_id()
    )
  );

CREATE POLICY "sale_items_insert"
  ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.branch_id = public.get_auth_branch_id()
    )
  );

-- --- ORDERS ---
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  );

CREATE POLICY "orders_insert"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  );

CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  );


-- 11. INITIAL BRANCH SEED DATA (EXACTLY 4 CORE BRANCHES)
INSERT INTO public.branches (name, branch_code, branch_type, active)
VALUES
  ('Main Branch', 'MAIN',     'MAIN',       true),
  ('Branch 1',    'BRANCH_1', 'SUB_BRANCH', true),
  ('Branch 2',    'BRANCH_2', 'SUB_BRANCH', true),
  ('Branch 3',    'BRANCH_3', 'SUB_BRANCH', true)
ON CONFLICT (branch_code) DO NOTHING;

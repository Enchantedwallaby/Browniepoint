-- ====================================================================
-- BROWNIE POINT OPERATIONS SYSTEM - NEW CATALOGUE PRODUCTS & OWNER RLS
-- Migration Version: 20261005000001_add_new_products_and_catalogue_rls.sql
-- Description: Adds show_weight_size column to products, updates RLS to
--              restrict catalogue writes exclusively to OWNER, and seeds
--              the 5 new products (Pineapple Cups, Choco Chips Cups,
--              Hazelnut Bento Bowl Small, Choco Chips Bento Bowl Small,
--              Black Forest Bento Bowl Small).
-- ====================================================================

-- 1. Add show_weight_size flag to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS show_weight_size boolean NOT NULL DEFAULT true;

-- 2. Update RLS Policies so ONLY Owner can insert/update/delete catalogue items

-- Products Table Policies
DROP POLICY IF EXISTS "products_write_owner_or_main" ON public.products;
DROP POLICY IF EXISTS "products_write_owner_only" ON public.products;

CREATE POLICY "products_write_owner_only"
  ON public.products FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Product Variants Table Policies
DROP POLICY IF EXISTS "variants_write_owner_or_main" ON public.product_variants;
DROP POLICY IF EXISTS "variants_write_owner_only" ON public.product_variants;

CREATE POLICY "variants_write_owner_only"
  ON public.product_variants FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Pricing Rules Table Policies
DROP POLICY IF EXISTS "pricing_write_owner_or_main" ON public.pricing_rules;
DROP POLICY IF EXISTS "pricing_write_owner_only" ON public.pricing_rules;

CREATE POLICY "pricing_write_owner_only"
  ON public.pricing_rules FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- 3. Seed helper for new products with optional weight display support
CREATE OR REPLACE FUNCTION public.seed_new_catalogue_product(
  p_name TEXT,
  p_category public.product_category,
  p_description TEXT,
  p_variant_name TEXT,
  p_qty_val NUMERIC,
  p_qty_unit public.quantity_unit,
  p_pricing_type public.pricing_type,
  p_base_price NUMERIC,
  p_show_weight_size BOOLEAN DEFAULT false
) RETURNS VOID AS $$
DECLARE
  v_product_id UUID;
  v_variant_id UUID;
BEGIN
  -- Insert or update product
  SELECT id INTO v_product_id FROM public.products WHERE name = p_name;
  IF v_product_id IS NULL THEN
    INSERT INTO public.products (name, category, description, show_weight_size, active)
    VALUES (p_name, p_category, p_description, p_show_weight_size, true)
    RETURNING id INTO v_product_id;
  ELSE
    UPDATE public.products
    SET category = p_category,
        description = p_description,
        show_weight_size = p_show_weight_size
    WHERE id = v_product_id;
  END IF;

  -- Insert or update variant
  SELECT id INTO v_variant_id FROM public.product_variants WHERE product_id = v_product_id AND name = p_variant_name;
  IF v_variant_id IS NULL THEN
    INSERT INTO public.product_variants (product_id, name, quantity_value, quantity_unit, active)
    VALUES (v_product_id, p_variant_name, p_qty_val, p_qty_unit, true)
    RETURNING id INTO v_variant_id;
  ELSE
    UPDATE public.product_variants SET quantity_value = p_qty_val, quantity_unit = p_qty_unit WHERE id = v_variant_id;
  END IF;

  -- Insert or update pricing rule
  IF EXISTS (SELECT 1 FROM public.pricing_rules WHERE product_variant_id = v_variant_id AND active = true) THEN
    UPDATE public.pricing_rules
    SET pricing_type = p_pricing_type, base_price = p_base_price
    WHERE product_variant_id = v_variant_id AND active = true;
  ELSE
    INSERT INTO public.pricing_rules (product_variant_id, pricing_type, base_price, active)
    VALUES (v_variant_id, p_pricing_type, p_base_price, true);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Execute seeding of the 5 new products
DO $$ BEGIN

  -- 1. Pineapple Cups (₹50)
  PERFORM public.seed_new_catalogue_product(
    'Pineapple Cups', 'Cup Cakes', 'Fresh pineapple cake cup', 'Standard', 1, 'PIECE', 'FIXED_PER_UNIT', 50, false
  );

  -- 2. Choco Chips Cups (₹50)
  PERFORM public.seed_new_catalogue_product(
    'Choco Chips Cups', 'Cup Cakes', 'Decadent choco chip cake cup', 'Standard', 1, 'PIECE', 'FIXED_PER_UNIT', 50, false
  );

  -- 3. Hazelnut Bento Bowl Small (₹130)
  PERFORM public.seed_new_catalogue_product(
    'Hazelnut Bento Bowl Small', 'Desserts', 'Rich hazelnut bento bowl dessert', 'Small', 1, 'PIECE', 'FIXED_PER_UNIT', 130, false
  );

  -- 4. Choco Chips Bento Bowl Small (₹130)
  PERFORM public.seed_new_catalogue_product(
    'Choco Chips Bento Bowl Small', 'Desserts', 'Choco chip bento bowl dessert', 'Small', 1, 'PIECE', 'FIXED_PER_UNIT', 130, false
  );

  -- 5. Black Forest Bento Bowl Small (₹130)
  PERFORM public.seed_new_catalogue_product(
    'Black Forest Bento Bowl Small', 'Desserts', 'Classic black forest bento bowl dessert', 'Small', 1, 'PIECE', 'FIXED_PER_UNIT', 130, false
  );

END $$;

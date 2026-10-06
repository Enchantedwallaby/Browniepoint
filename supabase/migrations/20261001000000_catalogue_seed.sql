-- ====================================================================
-- BROWNIE POINT OPERATIONS SYSTEM - CATALOGUE SEED MIGRATION
-- Migration Version: 20261001000000_catalogue_seed.sql
-- Description: Seeds the COMPLETE official Brownie Point menu catalogue,
--              variants (0.5 KG, 1 KG, 1 Pc, Box), standard menu prices,
--              and custom cake pricing configuration.
-- ====================================================================

-- Helper function to safely insert/update product, variant, and pricing rule
CREATE OR REPLACE FUNCTION public.seed_menu_product(
  p_name TEXT,
  p_category public.product_category,
  p_description TEXT,
  p_variant_name TEXT,
  p_qty_val NUMERIC,
  p_qty_unit public.quantity_unit,
  p_pricing_type public.pricing_type,
  p_base_price NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_product_id UUID;
  v_variant_id UUID;
BEGIN
  -- Insert or get product
  SELECT id INTO v_product_id FROM public.products WHERE name = p_name;
  IF v_product_id IS NULL THEN
    INSERT INTO public.products (name, category, description, active)
    VALUES (p_name, p_category, p_description, true)
    RETURNING id INTO v_product_id;
  ELSE
    UPDATE public.products SET category = p_category, description = p_description WHERE id = v_product_id;
  END IF;

  -- Insert or get variant
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

DO $$ BEGIN

  -- ====================================================================
  -- 1. CHEESE CAKES
  -- ====================================================================
  PERFORM public.seed_menu_product('Strawberry Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with strawberry topping', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Strawberry Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with strawberry topping', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 490);
  PERFORM public.seed_menu_product('Strawberry Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with strawberry topping', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 980);

  PERFORM public.seed_menu_product('Chocolate Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with chocolate', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Chocolate Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with chocolate', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 490);
  PERFORM public.seed_menu_product('Chocolate Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with chocolate', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 980);

  PERFORM public.seed_menu_product('Lemon Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with lemon', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Lemon Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with lemon', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 490);
  PERFORM public.seed_menu_product('Lemon Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with lemon', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 980);

  PERFORM public.seed_menu_product('Mango Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with mango', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Mango Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with mango', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 490);
  PERFORM public.seed_menu_product('Mango Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with mango', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 980);

  PERFORM public.seed_menu_product('Blue Berry Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with blueberry', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Blue Berry Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with blueberry', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 490);
  PERFORM public.seed_menu_product('Blue Berry Cheesecake', 'Cheese Cakes', 'Gooey Ricotta cheese cake with blueberry', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 980);

  PERFORM public.seed_menu_product('Red Velvet Cheese Cake', 'Cheese Cakes', 'Rich Cheese caked embedded with luscious cubes of Red Velvet Cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 490);
  PERFORM public.seed_menu_product('Red Velvet Cheese Cake', 'Cheese Cakes', 'Rich Cheese caked embedded with luscious cubes of Red Velvet Cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 980);

  -- ====================================================================
  -- 2. SUGAR FREE CAKES
  -- ====================================================================
  PERFORM public.seed_menu_product('Chocolate Truffle Sugar Free', 'Sugar Free Cakes', 'Eggless sugar free chocolate truffle cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 700);
  PERFORM public.seed_menu_product('Chocolate Truffle Sugar Free', 'Sugar Free Cakes', 'Eggless sugar free chocolate truffle cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1400);

  PERFORM public.seed_menu_product('Chocolate Walnut Sugar Free', 'Sugar Free Cakes', 'Sugar free chocolate walnut cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 750);
  PERFORM public.seed_menu_product('Chocolate Walnut Sugar Free', 'Sugar Free Cakes', 'Sugar free chocolate walnut cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1500);

  PERFORM public.seed_menu_product('Chocolate Almond Sugar Free', 'Sugar Free Cakes', 'Sugar free chocolate almond cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 750);
  PERFORM public.seed_menu_product('Chocolate Almond Sugar Free', 'Sugar Free Cakes', 'Sugar free chocolate almond cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1500);

  -- ====================================================================
  -- 3. TEA-TIME CAKES & BAKERY
  -- ====================================================================
  PERFORM public.seed_menu_product('Banana Walnut', 'Tea-Time Cakes', 'Fresh banana walnut tea cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 140);
  PERFORM public.seed_menu_product('Date Walnut', 'Tea-Time Cakes', 'Date and walnut tea cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 140);
  PERFORM public.seed_menu_product('Plum', 'Tea-Time Cakes', 'Classic plum cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 140);
  PERFORM public.seed_menu_product('Chocolate Walnut', 'Tea-Time Cakes', 'Chocolate walnut tea cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 140);
  PERFORM public.seed_menu_product('Chocolate Vanilla', 'Tea-Time Cakes', 'Marble chocolate vanilla tea cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 140);
  PERFORM public.seed_menu_product('Red Velvet Tea Cake', 'Tea-Time Cakes', 'Red velvet tea cake loaf', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 140);
  PERFORM public.seed_menu_product('Vanilla Tea Cake', 'Tea-Time Cakes', 'Classic vanilla tea cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 140);
  PERFORM public.seed_menu_product('Plain Toast', 'Tea-Time Cakes', 'Crispy plain rusk toast', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 45);
  PERFORM public.seed_menu_product('Jeera Toast / Masala Toast', 'Tea-Time Cakes', 'Flavoured toast pack', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 50);
  PERFORM public.seed_menu_product('Cake Toast', 'Tea-Time Cakes', 'Sweet cake toast pack', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Plain Khari', 'Tea-Time Cakes', 'Crispy puff khari', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 45);
  PERFORM public.seed_menu_product('Masala Khari', 'Tea-Time Cakes', 'Masala / Methi / Jeera / Kothmir khari', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Sugar Khari', 'Tea-Time Cakes', 'Sweet sugar glazed khari', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Chilly / Sesame Toast', 'Tea-Time Cakes', 'Chilly sesame toast pack', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 95);

  -- ====================================================================
  -- 4. COOKIES & BREADS
  -- ====================================================================
  PERFORM public.seed_menu_product('Red Velvet Cookies', 'Cookies', 'Red velvet cookie pack', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Tutti Frutti Cookies', 'Cookies', 'Tutti frutti cookie pack', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Chocolate Chips Cookies', 'Cookies', 'Choco chip cookies', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Nankhatai', 'Cookies', 'Traditional nankhatai cookies', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Butter Cookies', 'Cookies', 'Rich butter cookies', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 85);
  PERFORM public.seed_menu_product('Double Chocolate Cookies', 'Cookies', 'Double chocolate cookies', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 85);
  PERFORM public.seed_menu_product('Kesar Pista Cookies', 'Cookies', 'Saffron pistachio cookies', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 85);
  PERFORM public.seed_menu_product('Plain Cookies', 'Cookies', 'Classic plain cookies', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Jeera Cookies', 'Cookies', 'Cumin jeera cookies', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 60);
  PERFORM public.seed_menu_product('Ajwain Cookies', 'Cookies', 'Ajwain cookies', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 60);
  PERFORM public.seed_menu_product('Garlic Cookies', 'Cookies', 'Garlic savoury cookies', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 60);
  PERFORM public.seed_menu_product('Mixed Herb Cookies', 'Cookies', 'Mixed herb cookies', '1 Packet', 1, 'BOX', 'FIXED_PER_UNIT', 60);
  PERFORM public.seed_menu_product('Burger Buns', 'Cookies', 'Fresh burger buns pack', '1 Pack', 1, 'BOX', 'FIXED_PER_UNIT', 28);
  PERFORM public.seed_menu_product('Ladi Pav', 'Cookies', 'Fresh ladi pav pack', '1 Pack', 1, 'BOX', 'FIXED_PER_UNIT', 38);
  PERFORM public.seed_menu_product('Pizza Base', 'Cookies', 'Fresh pizza base pack Small / Big', '1 Pack', 1, 'BOX', 'FIXED_PER_UNIT', 43);
  PERFORM public.seed_menu_product('Garlic Bread', 'Cookies', 'Garlic bread loaf', '1 Loaf', 1, 'BOX', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Kulcha Bread', 'Cookies', 'Fresh kulcha bread pack', '1 Pack', 1, 'BOX', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Multigrain Bread', 'Cookies', 'Healthy multigrain bread loaf', '1 Loaf', 1, 'BOX', 'FIXED_PER_UNIT', 75);

  -- ====================================================================
  -- 5. BROWNIES
  -- ====================================================================
  PERFORM public.seed_menu_product('Chocolate Brownie', 'Brownies', 'Classic dense American gooey brownie', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 65);
  PERFORM public.seed_menu_product('Chocolate Brownie', 'Brownies', 'Classic dense American gooey brownie', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 700);

  PERFORM public.seed_menu_product('Chocolate Walnut Brownie', 'Brownies', 'Chocolate brownie with walnuts', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);
  PERFORM public.seed_menu_product('Chocolate Walnut Brownie', 'Brownies', 'Chocolate brownie with walnuts', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 750);

  PERFORM public.seed_menu_product('Chocolate Fudge Brownie', 'Brownies', 'Fudge chocolate brownie', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Chocolate Fudge Brownie', 'Brownies', 'Fudge chocolate brownie', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 800);

  PERFORM public.seed_menu_product('Swiss Brownie', 'Brownies', 'Swiss chocolate brownie', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 80);
  PERFORM public.seed_menu_product('Swiss Brownie', 'Brownies', 'Swiss chocolate brownie', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 900);

  PERFORM public.seed_menu_product('Walnut Fudge Brownie', 'Brownies', 'Walnut fudge brownie', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 80);
  PERFORM public.seed_menu_product('Walnut Fudge Brownie', 'Brownies', 'Walnut fudge brownie', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 900);

  PERFORM public.seed_menu_product('Kitkat Brownie', 'Brownies', 'Kitkat topped brownie', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 80);
  PERFORM public.seed_menu_product('Kitkat Brownie', 'Brownies', 'Kitkat topped brownie', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 900);

  PERFORM public.seed_menu_product('Hazelnut Brownie', 'Brownies', 'Hazelnut chocolate brownie', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 80);
  PERFORM public.seed_menu_product('Hazelnut Brownie', 'Brownies', 'Hazelnut chocolate brownie', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 900);

  PERFORM public.seed_menu_product('Chunky Hazelnut Brownie', 'Brownies', 'Chunky hazelnut brownie', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 85);
  PERFORM public.seed_menu_product('Chunky Hazelnut Brownie', 'Brownies', 'Chunky hazelnut brownie', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 950);

  PERFORM public.seed_menu_product('Chocolate Emperor Brownie', 'Brownies', 'Emperor chocolate brownie', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 85);
  PERFORM public.seed_menu_product('Chocolate Emperor Brownie', 'Brownies', 'Emperor chocolate brownie', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 950);

  PERFORM public.seed_menu_product('Chocolate Ferrero Brownie', 'Brownies', 'Ferrero Rocher brownie', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 85);
  PERFORM public.seed_menu_product('Chocolate Ferrero Brownie', 'Brownies', 'Ferrero Rocher brownie', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 950);

  PERFORM public.seed_menu_product('Chocolate Overload Brownie', 'Brownies', 'Ultimate chocolate overload brownie', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 100);
  PERFORM public.seed_menu_product('Chocolate Overload Brownie', 'Brownies', 'Ultimate chocolate overload brownie', 'Large Tray', 1, 'BOX', 'FIXED_PER_UNIT', 1050);

  -- ====================================================================
  -- 6. MACAROONS
  -- ====================================================================
  PERFORM public.seed_menu_product('Chocolate Macaron', 'Macarons', 'Classic French Macaroon - Chocolate', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 50);
  PERFORM public.seed_menu_product('Lavender Macaron', 'Macarons', 'Classic French Macaroon - Lavender', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 50);
  PERFORM public.seed_menu_product('Coffee Macaron', 'Macarons', 'Classic French Macaroon - Coffee', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 50);
  PERFORM public.seed_menu_product('Strawberry Macaron', 'Macarons', 'Classic French Macaroon - Strawberry', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 50);
  PERFORM public.seed_menu_product('Cotton Candy Macaron', 'Macarons', 'Classic French Macaroon - Cotton Candy', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 50);

  -- ====================================================================
  -- 7. CUP CAKES
  -- ====================================================================
  PERFORM public.seed_menu_product('Vanilla Cupcake', 'Cup Cakes', 'Vanilla cupcake topped with butter cream', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 50);
  PERFORM public.seed_menu_product('Chocolate Cupcake', 'Cup Cakes', 'Chocolate cupcake topped with butter cream', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Chocolate Truffle Cupcake', 'Cup Cakes', 'Rich chocolate truffle cupcake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);
  PERFORM public.seed_menu_product('Oreo Cupcake', 'Cup Cakes', 'Oreo topped cupcake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);
  PERFORM public.seed_menu_product('Black Forest Cupcake', 'Cup Cakes', 'Black forest cupcake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);
  PERFORM public.seed_menu_product('Kit Kat Cupcake', 'Cup Cakes', 'Kit Kat topped cupcake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);
  PERFORM public.seed_menu_product('Red Velvet Cupcake', 'Cup Cakes', 'Red velvet cupcake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);

  -- ====================================================================
  -- 8. CAKES - CREAM / FRUIT BASED
  -- ====================================================================
  PERFORM public.seed_menu_product('Vanilla', 'Cakes', 'Classic vanilla fresh cream cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 249);
  PERFORM public.seed_menu_product('Vanilla', 'Cakes', 'Classic vanilla fresh cream cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 498);

  PERFORM public.seed_menu_product('Strawberry Forest', 'Cakes', 'Gateau with strawberry cream and chocolate', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 295);
  PERFORM public.seed_menu_product('Strawberry Forest', 'Cakes', 'Gateau with strawberry cream and chocolate', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 590);

  PERFORM public.seed_menu_product('Orange Forest', 'Cakes', 'Orange cream and chocolate combo', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 295);
  PERFORM public.seed_menu_product('Orange Forest', 'Cakes', 'Orange cream and chocolate combo', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 590);

  PERFORM public.seed_menu_product('Caramel Coffee', 'Cakes', 'Caramel and coffee cream cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 295);
  PERFORM public.seed_menu_product('Caramel Coffee', 'Cakes', 'Caramel and coffee cream cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 670);

  PERFORM public.seed_menu_product('Black Currant', 'Cakes', 'Black currant fresh cream cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 320);
  PERFORM public.seed_menu_product('Black Currant', 'Cakes', 'Black currant fresh cream cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 640);

  PERFORM public.seed_menu_product('Black Jamun', 'Cakes', 'Black jamun flavoured cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 339);
  PERFORM public.seed_menu_product('Black Jamun', 'Cakes', 'Black jamun flavoured cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 670);

  PERFORM public.seed_menu_product('Chikku', 'Cakes', 'Chikku fruit cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 350);
  PERFORM public.seed_menu_product('Chikku', 'Cakes', 'Chikku fruit cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 700);

  PERFORM public.seed_menu_product('Kiwi', 'Cakes', 'Fresh kiwi cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 380);
  PERFORM public.seed_menu_product('Kiwi', 'Cakes', 'Fresh kiwi cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 760);

  PERFORM public.seed_menu_product('Mango Delight', 'Cakes', 'Round shaped mango cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Mango Delight', 'Cakes', 'Round shaped mango cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 340);
  PERFORM public.seed_menu_product('Mango Delight', 'Cakes', 'Round shaped mango cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 680);

  PERFORM public.seed_menu_product('Blueberry Delight', 'Cakes', 'Round shaped blueberry cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Blueberry Delight', 'Cakes', 'Round shaped blueberry cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 340);
  PERFORM public.seed_menu_product('Blueberry Delight', 'Cakes', 'Round shaped blueberry cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 680);

  PERFORM public.seed_menu_product('Strawberry Delight', 'Cakes', 'Round shaped strawberry cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Strawberry Delight', 'Cakes', 'Round shaped strawberry cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 340);
  PERFORM public.seed_menu_product('Strawberry Delight', 'Cakes', 'Round shaped strawberry cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 680);

  PERFORM public.seed_menu_product('Ebony Ivory Cake', 'Cakes', 'Dual chocolate Ebony Ivory cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 370);
  PERFORM public.seed_menu_product('Ebony Ivory Cake', 'Cakes', 'Dual chocolate Ebony Ivory cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 740);

  PERFORM public.seed_menu_product('Caramel Butterscotch', 'Cakes', 'Rich caramel butterscotch cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 375);
  PERFORM public.seed_menu_product('Caramel Butterscotch', 'Cakes', 'Rich caramel butterscotch cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 750);

  PERFORM public.seed_menu_product('Butterscotch', 'Cakes', 'Classic butterscotch fresh cream cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 375);
  PERFORM public.seed_menu_product('Butterscotch', 'Cakes', 'Classic butterscotch fresh cream cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 750);

  PERFORM public.seed_menu_product('Black Forest', 'Cakes', 'Classic Black Forest with layers of fresh cream & cherry flakes', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Black Forest', 'Cakes', 'Classic Black Forest with layers of fresh cream & cherry flakes', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 380);
  PERFORM public.seed_menu_product('Black Forest', 'Cakes', 'Classic Black Forest with layers of fresh cream & cherry flakes', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 730);

  PERFORM public.seed_menu_product('Fresh Pineapple', 'Cakes', 'Fresh cream and pineapple cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Fresh Pineapple', 'Cakes', 'Fresh cream and pineapple cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 380);
  PERFORM public.seed_menu_product('Fresh Pineapple', 'Cakes', 'Fresh cream and pineapple cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 730);

  PERFORM public.seed_menu_product('Tender Coconut', 'Cakes', 'Fresh tender coconut cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 400);
  PERFORM public.seed_menu_product('Tender Coconut', 'Cakes', 'Fresh tender coconut cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 800);

  PERFORM public.seed_menu_product('Custard Apple', 'Cakes', 'Fresh custard apple cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 470);
  PERFORM public.seed_menu_product('Custard Apple', 'Cakes', 'Fresh custard apple cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 940);

  PERFORM public.seed_menu_product('Lotus Biscoff', 'Cakes', 'Lotus Biscoff speculoos cream cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 650);
  PERFORM public.seed_menu_product('Lotus Biscoff', 'Cakes', 'Lotus Biscoff speculoos cream cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1300);

  PERFORM public.seed_menu_product('Chilly Guava Cake', 'Cakes', 'Chilly guava flavoured cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 365);
  PERFORM public.seed_menu_product('Chilly Guava Cake', 'Cakes', 'Chilly guava flavoured cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 730);

  PERFORM public.seed_menu_product('Cream Nougat', 'Cakes', 'Cream nougat fresh cream cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);
  PERFORM public.seed_menu_product('Cream Nougat', 'Cakes', 'Cream nougat fresh cream cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 375);
  PERFORM public.seed_menu_product('Cream Nougat', 'Cakes', 'Cream nougat fresh cream cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 750);

  PERFORM public.seed_menu_product('Royal Falooda Cake', 'Cakes', 'Falooda flavoured fresh cream cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 415);
  PERFORM public.seed_menu_product('Royal Falooda Cake', 'Cakes', 'Falooda flavoured fresh cream cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 830);

  PERFORM public.seed_menu_product('Mixed Fruit Gateau', 'Cakes', 'Mixed fruit fresh cream and crunchy almonds', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 85);
  PERFORM public.seed_menu_product('Mixed Fruit Gateau', 'Cakes', 'Mixed fruit fresh cream and crunchy almonds', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 440);
  PERFORM public.seed_menu_product('Mixed Fruit Gateau', 'Cakes', 'Mixed fruit fresh cream and crunchy almonds', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 880);

  PERFORM public.seed_menu_product('Rasmalai Fresh Cream', 'Cakes', 'Thandai flavoured cream cake with fresh rasmalai', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Rasmalai Fresh Cream', 'Cakes', 'Thandai flavoured cream cake with fresh rasmalai', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 470);
  PERFORM public.seed_menu_product('Rasmalai Fresh Cream', 'Cakes', 'Thandai flavoured cream cake with fresh rasmalai', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 940);

  PERFORM public.seed_menu_product('Gulab Jamun Fresh Cream', 'Cakes', 'Thandai cream cake with gulab jamun pcs', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 470);
  PERFORM public.seed_menu_product('Gulab Jamun Fresh Cream', 'Cakes', 'Thandai cream cake with gulab jamun pcs', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 940);

  PERFORM public.seed_menu_product('Motichoor Rabdi', 'Cakes', 'Saffron cream cake with pearls of Motichoor Rabdi', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 470);
  PERFORM public.seed_menu_product('Motichoor Rabdi', 'Cakes', 'Saffron cream cake with pearls of Motichoor Rabdi', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 940);

  PERFORM public.seed_menu_product('Fresh Mango', 'Cakes', 'Classic vanilla and fresh mango cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 470);
  PERFORM public.seed_menu_product('Fresh Mango', 'Cakes', 'Classic vanilla and fresh mango cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 940);

  PERFORM public.seed_menu_product('Red Velvet', 'Cakes', 'Classic Red Velvet cake with cream cheese frosting', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Red Velvet', 'Cakes', 'Classic Red Velvet cake with cream cheese frosting', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 490);
  PERFORM public.seed_menu_product('Red Velvet', 'Cakes', 'Classic Red Velvet cake with cream cheese frosting', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 980);

  PERFORM public.seed_menu_product('Mixed Fruit Almond', 'Cakes', 'Mixed fruit cake with crunchy almonds', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);
  PERFORM public.seed_menu_product('Mixed Fruit Almond', 'Cakes', 'Mixed fruit cake with crunchy almonds', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 990);

  PERFORM public.seed_menu_product('Saffron Tres Leche Cake', 'Cakes', 'Saffron tres leche milk cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 550);
  PERFORM public.seed_menu_product('Saffron Tres Leche Cake', 'Cakes', 'Saffron tres leche milk cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1100);

  PERFORM public.seed_menu_product('Fruit Exotic Cake', 'Cakes', 'Exotic fresh fruit cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 550);
  PERFORM public.seed_menu_product('Fruit Exotic Cake', 'Cakes', 'Exotic fresh fruit cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1100);

  PERFORM public.seed_menu_product('Fresh Strawberry Almond', 'Cakes', 'Fresh strawberry cake with crunchy almonds', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 530);
  PERFORM public.seed_menu_product('Fresh Strawberry Almond', 'Cakes', 'Fresh strawberry cake with crunchy almonds', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1060);

  PERFORM public.seed_menu_product('Fresh Mango Almond Cake', 'Cakes', 'Fresh mango cake with crunchy almonds', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 530);
  PERFORM public.seed_menu_product('Fresh Mango Almond Cake', 'Cakes', 'Fresh mango cake with crunchy almonds', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1060);

  PERFORM public.seed_menu_product('Tiramisu', 'Cakes', 'Classic coffee tiramisu cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 550);
  PERFORM public.seed_menu_product('Tiramisu', 'Cakes', 'Classic coffee tiramisu cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1100);

  PERFORM public.seed_menu_product('Mango Maharaja', 'Cakes', 'Premium mango cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 620);
  PERFORM public.seed_menu_product('Mango Maharaja', 'Cakes', 'Premium mango cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1240);

  PERFORM public.seed_menu_product('Rainbow Cake', 'Cakes', 'Vanilla cake with rainbow coloured fruit flavoured cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 650);
  PERFORM public.seed_menu_product('Rainbow Cake', 'Cakes', 'Vanilla cake with rainbow coloured fruit flavoured cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1300);

  -- ====================================================================
  -- 9. CAKES - CHOCOLATE BASED
  -- ====================================================================
  PERFORM public.seed_menu_product('Choco Light', 'Cakes', 'Light chocolate cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 249);
  PERFORM public.seed_menu_product('Choco Light', 'Cakes', 'Light chocolate cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 498);

  PERFORM public.seed_menu_product('Choco Strips', 'Cakes', 'Chocolate base with chocolate strips', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 249);
  PERFORM public.seed_menu_product('Choco Strips', 'Cakes', 'Chocolate base with chocolate strips', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 498);

  PERFORM public.seed_menu_product('Caramel Coffee', 'Cakes', 'Creamy gateau of luscious caramel and coffee', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 335);
  PERFORM public.seed_menu_product('Caramel Coffee', 'Cakes', 'Creamy gateau of luscious caramel and coffee', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 670);

  PERFORM public.seed_menu_product('Chocolate Flake', 'Cakes', 'Creamy chocolate and chocolate flakes', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 355);
  PERFORM public.seed_menu_product('Chocolate Flake', 'Cakes', 'Creamy chocolate and chocolate flakes', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 670);

  PERFORM public.seed_menu_product('Choco Marble', 'Cakes', 'Marble chocolate cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 350);
  PERFORM public.seed_menu_product('Choco Marble', 'Cakes', 'Marble chocolate cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 700);

  PERFORM public.seed_menu_product('Choco Vanilla', 'Cakes', 'Choco vanilla combo cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 350);
  PERFORM public.seed_menu_product('Choco Vanilla', 'Cakes', 'Choco vanilla combo cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 700);

  PERFORM public.seed_menu_product('Choco Cream Cake', 'Cakes', 'Chocolate cream cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 390);
  PERFORM public.seed_menu_product('Choco Cream Cake', 'Cakes', 'Chocolate cream cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 780);

  PERFORM public.seed_menu_product('Regal Chocolate', 'Cakes', 'Chocolate cake with chocolate drizzle', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);
  PERFORM public.seed_menu_product('Regal Chocolate', 'Cakes', 'Chocolate cake with chocolate drizzle', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 380);
  PERFORM public.seed_menu_product('Regal Chocolate', 'Cakes', 'Chocolate cake with chocolate drizzle', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 760);

  PERFORM public.seed_menu_product('Chocolate Delight Cake', 'Cakes', 'Rich chocolate delight cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 380);
  PERFORM public.seed_menu_product('Chocolate Delight Cake', 'Cakes', 'Rich chocolate delight cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 760);

  PERFORM public.seed_menu_product('Royal Chocolate Cream Cake', 'Cakes', 'Royal chocolate cream cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 380);
  PERFORM public.seed_menu_product('Royal Chocolate Cream Cake', 'Cakes', 'Royal chocolate cream cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 760);

  PERFORM public.seed_menu_product('Choco Cream Nougat', 'Cakes', 'Chocolate cream nougat cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);
  PERFORM public.seed_menu_product('Choco Cream Nougat', 'Cakes', 'Chocolate cream nougat cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 380);
  PERFORM public.seed_menu_product('Choco Cream Nougat', 'Cakes', 'Chocolate cream nougat cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 760);

  PERFORM public.seed_menu_product('Choco Vanilla Trio Cake', 'Cakes', 'Choco vanilla trio layered cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Choco Vanilla Trio Cake', 'Cakes', 'Choco vanilla trio layered cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 390);
  PERFORM public.seed_menu_product('Choco Vanilla Trio Cake', 'Cakes', 'Choco vanilla trio layered cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 780);

  PERFORM public.seed_menu_product('Chocolate Mocha Caramel', 'Cakes', 'Coffee, caramel and chocolate cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 390);
  PERFORM public.seed_menu_product('Chocolate Mocha Caramel', 'Cakes', 'Coffee, caramel and chocolate cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 780);

  PERFORM public.seed_menu_product('Chocolate Chips', 'Cakes', 'Chocolate cream and chips cake with chocolate drizzle', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Chocolate Chips', 'Cakes', 'Chocolate cream and chips cake with chocolate drizzle', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 390);
  PERFORM public.seed_menu_product('Chocolate Chips', 'Cakes', 'Chocolate cream and chips cake with chocolate drizzle', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 780);

  PERFORM public.seed_menu_product('Chocolate Cream Truffle', 'Cakes', 'Chocolate cream truffle cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 410);
  PERFORM public.seed_menu_product('Chocolate Cream Truffle', 'Cakes', 'Chocolate cream truffle cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 820);

  PERFORM public.seed_menu_product('Dark Chocolate Crinkle', 'Cakes', 'Dark chocolate crinkle cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 390);
  PERFORM public.seed_menu_product('Dark Chocolate Crinkle', 'Cakes', 'Dark chocolate crinkle cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 780);

  PERFORM public.seed_menu_product('Milk Chocolate Crinkle', 'Cakes', 'Milk chocolate crinkle cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 390);
  PERFORM public.seed_menu_product('Milk Chocolate Crinkle', 'Cakes', 'Milk chocolate crinkle cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 780);

  PERFORM public.seed_menu_product('Chocolate Cream Crunchy', 'Cakes', 'Chocolate crunchy cake with chocolate cream swirls', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 420);
  PERFORM public.seed_menu_product('Chocolate Cream Crunchy', 'Cakes', 'Chocolate crunchy cake with chocolate cream swirls', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 840);

  PERFORM public.seed_menu_product('Dutch Truffle', 'Cakes', 'The classic Dutch chocolate cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 80);
  PERFORM public.seed_menu_product('Dutch Truffle', 'Cakes', 'The classic Dutch chocolate cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 440);
  PERFORM public.seed_menu_product('Dutch Truffle', 'Cakes', 'The classic Dutch chocolate cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 880);

  PERFORM public.seed_menu_product('Opera Cake', 'Cakes', 'Vanilla cake layered with coffee cream and chocolate ganache', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 75);
  PERFORM public.seed_menu_product('Opera Cake', 'Cakes', 'Vanilla cake layered with coffee cream and chocolate ganache', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 440);
  PERFORM public.seed_menu_product('Opera Cake', 'Cakes', 'Vanilla cake layered with coffee cream and chocolate ganache', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 880);

  PERFORM public.seed_menu_product('Zebra Torte Cake', 'Cakes', 'Zebra torte chocolate cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 460);
  PERFORM public.seed_menu_product('Zebra Torte Cake', 'Cakes', 'Zebra torte chocolate cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 920);

  PERFORM public.seed_menu_product('Caramel Zebra', 'Cakes', 'Chocolate and caramel cream cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 450);
  PERFORM public.seed_menu_product('Caramel Zebra', 'Cakes', 'Chocolate and caramel cream cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 900);

  PERFORM public.seed_menu_product('Chocolate Caramel', 'Cakes', 'Chocolate & caramel cake with butterscotch', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 80);
  PERFORM public.seed_menu_product('Chocolate Caramel', 'Cakes', 'Chocolate & caramel cake with butterscotch', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 470);
  PERFORM public.seed_menu_product('Chocolate Caramel', 'Cakes', 'Chocolate & caramel cake with butterscotch', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 940);

  PERFORM public.seed_menu_product('Choco Truffle', 'Cakes', 'Rich chocolate truffle cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 450);
  PERFORM public.seed_menu_product('Choco Truffle', 'Cakes', 'Rich chocolate truffle cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 900);

  PERFORM public.seed_menu_product('50 / 50', 'Cakes', 'Half Chocolate and Half Fruit cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 480);
  PERFORM public.seed_menu_product('50 / 50', 'Cakes', 'Half Chocolate and Half Fruit cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 960);

  PERFORM public.seed_menu_product('Kitkat Gateau', 'Cakes', 'Dark chocolate cake with Kit Kat fillings and toppings', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 480);
  PERFORM public.seed_menu_product('Kitkat Gateau', 'Cakes', 'Dark chocolate cake with Kit Kat fillings and toppings', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 960);

  PERFORM public.seed_menu_product('Rich Walnut', 'Cakes', 'Classic chocolate cake for walnut lovers', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Rich Walnut', 'Cakes', 'Classic chocolate cake for walnut lovers', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);
  PERFORM public.seed_menu_product('Rich Walnut', 'Cakes', 'Classic chocolate cake for walnut lovers', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 990);

  PERFORM public.seed_menu_product('Rich Almond', 'Cakes', 'Rich chocolate and almond cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Rich Almond', 'Cakes', 'Rich chocolate and almond cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);
  PERFORM public.seed_menu_product('Rich Almond', 'Cakes', 'Rich chocolate and almond cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 990);

  PERFORM public.seed_menu_product('Chocolate Fantasy', 'Cakes', 'Rich chocolate cake with almonds, hazelnut, walnuts and nougat', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);
  PERFORM public.seed_menu_product('Chocolate Fantasy', 'Cakes', 'Rich chocolate cake with almonds, hazelnut, walnuts and nougat', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 990);

  PERFORM public.seed_menu_product('Chocolate Hazelnut Cake', 'Cakes', 'Chocolate ganache cake with crunchy hazelnuts', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);
  PERFORM public.seed_menu_product('Chocolate Hazelnut Cake', 'Cakes', 'Chocolate ganache cake with crunchy hazelnuts', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 990);

  PERFORM public.seed_menu_product('Swiss Truffle', 'Cakes', 'Chocolate cake with layers of chocolate cream, chips and flakes', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Swiss Truffle', 'Cakes', 'Chocolate cake with layers of chocolate cream, chips and flakes', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);
  PERFORM public.seed_menu_product('Swiss Truffle', 'Cakes', 'Chocolate cake with layers of chocolate cream, chips and flakes', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 990);

  PERFORM public.seed_menu_product('Belgian Nougat', 'Cakes', 'Dark Belgian chocolate with crunchy nougat and dark ganache', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Belgian Nougat', 'Cakes', 'Dark Belgian chocolate with crunchy nougat and dark ganache', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);
  PERFORM public.seed_menu_product('Belgian Nougat', 'Cakes', 'Dark Belgian chocolate with crunchy nougat and dark ganache', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 990);

  PERFORM public.seed_menu_product('Choc. Short Cakes', 'Cakes', 'Dense chocolate cake with layers of caramel and chocolate mousse', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Choc. Short Cakes', 'Cakes', 'Dense chocolate cake with layers of caramel and chocolate mousse', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);
  PERFORM public.seed_menu_product('Choc. Short Cakes', 'Cakes', 'Dense chocolate cake with layers of caramel and chocolate mousse', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 990);

  PERFORM public.seed_menu_product('Summer Surprise Cream Cake', 'Cakes', 'Mango & strawberry cake with colorful cream rosettes', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);
  PERFORM public.seed_menu_product('Summer Surprise Cream Cake', 'Cakes', 'Mango & strawberry cake with colorful cream rosettes', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 990);

  PERFORM public.seed_menu_product('Chocolate Hazelnut Nougat Torte', 'Cakes', 'Rich Belgian chocolate cake with hazelnut and nougat', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);
  PERFORM public.seed_menu_product('Chocolate Hazelnut Nougat Torte', 'Cakes', 'Rich Belgian chocolate cake with hazelnut and nougat', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 990);

  PERFORM public.seed_menu_product('Belgian Hazelnut Cake', 'Cakes', 'Belgian hazelnut chocolate cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 540);
  PERFORM public.seed_menu_product('Belgian Hazelnut Cake', 'Cakes', 'Belgian hazelnut chocolate cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1080);

  PERFORM public.seed_menu_product('Caramel Fruit Cake', 'Cakes', 'Caramel and fruit cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 500);
  PERFORM public.seed_menu_product('Caramel Fruit Cake', 'Cakes', 'Caramel and fruit cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1000);

  PERFORM public.seed_menu_product('Strawberry Chocolate', 'Cakes', 'Chocolate truffle with strawberries', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 95);
  PERFORM public.seed_menu_product('Strawberry Chocolate', 'Cakes', 'Chocolate truffle with strawberries', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 520);
  PERFORM public.seed_menu_product('Strawberry Chocolate', 'Cakes', 'Chocolate truffle with strawberries', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1040);

  PERFORM public.seed_menu_product('Chocolate Mango Cake', 'Cakes', 'Chocolate truffle with mangoes', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 520);
  PERFORM public.seed_menu_product('Chocolate Mango Cake', 'Cakes', 'Chocolate truffle with mangoes', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1040);

  PERFORM public.seed_menu_product('Grandma Choco Cake', 'Cakes', 'Classic buttermilk dark chocolate cake with chocolate ganache', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 670);
  PERFORM public.seed_menu_product('Grandma Choco Cake', 'Cakes', 'Classic buttermilk dark chocolate cake with chocolate ganache', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1140);

  PERFORM public.seed_menu_product('Double Chocolate Cake', 'Cakes', 'Trio of chocolate cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 550);
  PERFORM public.seed_menu_product('Double Chocolate Cake', 'Cakes', 'Trio of chocolate cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1100);

  PERFORM public.seed_menu_product('Trio of Chocolate Cake', 'Cakes', 'Trio of dark, milk and white chocolate', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 550);
  PERFORM public.seed_menu_product('Trio of Chocolate Cake', 'Cakes', 'Trio of dark, milk and white chocolate', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1100);

  PERFORM public.seed_menu_product('Bailey\'s Poke Cake', 'Cakes', 'Bailey\'s Irish cream poke cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 600);
  PERFORM public.seed_menu_product('Bailey\'s Poke Cake', 'Cakes', 'Bailey\'s Irish cream poke cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1200);

  PERFORM public.seed_menu_product('Ferraro Rocher Cake', 'Cakes', 'Dark chocolate embedded with chopped Ferrero Rocher', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 650);
  PERFORM public.seed_menu_product('Ferraro Rocher Cake', 'Cakes', 'Dark chocolate embedded with chopped Ferrero Rocher', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1300);

  PERFORM public.seed_menu_product('Premium Kitkat', 'Cakes', 'Rich Dutch truffle cake with Kitkat', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 650);
  PERFORM public.seed_menu_product('Premium Kitkat', 'Cakes', 'Rich Dutch truffle cake with Kitkat', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1300);

  PERFORM public.seed_menu_product('Chocolate Shard Cake', 'Cakes', 'Chocolate shard decorated cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 650);
  PERFORM public.seed_menu_product('Chocolate Shard Cake', 'Cakes', 'Chocolate shard decorated cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1300);

  PERFORM public.seed_menu_product('Pull me up Cake', 'Cakes', 'Chocolate & caramel cake with dripping chocolate sauce & brownie nut topping', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 700);
  PERFORM public.seed_menu_product('Pull me up Cake', 'Cakes', 'Chocolate & caramel cake with dripping chocolate sauce & brownie nut topping', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1400);

  PERFORM public.seed_menu_product('Pinata Cake (Heart Shape)', 'Cakes', 'Chocolate dome with surprise cake inside & hammer', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 750);

  PERFORM public.seed_menu_product('Pinata Cake (Sphere Shape)', 'Cakes', 'Chocolate sphere dome with surprise cake inside & hammer', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 1050);
  PERFORM public.seed_menu_product('Pinata Cake (Sphere Shape)', 'Cakes', 'Chocolate sphere dome with surprise cake inside & hammer', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1950);

  PERFORM public.seed_menu_product('Scrolling Photo Cake', 'Cakes', 'Custom photo cake with scrolling photo reel', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1250);

  PERFORM public.seed_menu_product('Surprise Explosion Cake (D/T)', 'Cakes', 'Explosion surprise box cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 1200);

  PERFORM public.seed_menu_product('Surprise Box', 'Cakes', 'Luxury surprise box cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 2700);
  PERFORM public.seed_menu_product('Surprise Box', 'Cakes', 'Luxury surprise box cake', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 3500);

  PERFORM public.seed_menu_product('German Black Forest', 'Cakes', 'German style Black Forest cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 399);

  PERFORM public.seed_menu_product('Choco Truffle Sugarless', 'Cakes', 'Sugarless dark chocolate truffle cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 750);

  PERFORM public.seed_menu_product('Choco Hazelnut', 'Cakes', 'Chocolate hazelnut cake', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 495);

  -- ====================================================================
  -- 10. CAKES - MOUSSE BASED
  -- ====================================================================
  PERFORM public.seed_menu_product('Belgian Mousse Cake', 'Cakes', 'Belgian mousse topped with chocolate flake & curls', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Belgian Mousse Cake', 'Cakes', 'Belgian mousse topped with chocolate flake & curls', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 480);
  PERFORM public.seed_menu_product('Belgian Mousse Cake', 'Cakes', 'Belgian mousse topped with chocolate flake & curls', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 960);

  PERFORM public.seed_menu_product('Death by Chocolate', 'Cakes', 'Chocolate mousse cake with brownies base, butterscotch & walnut', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Death by Chocolate', 'Cakes', 'Chocolate mousse cake with brownies base, butterscotch & walnut', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 480);
  PERFORM public.seed_menu_product('Death by Chocolate', 'Cakes', 'Chocolate mousse cake with brownies base, butterscotch & walnut', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 960);

  PERFORM public.seed_menu_product('Swiss Oreo', 'Cakes', 'Chocolate cake with Oreo cookies and mousse', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Swiss Oreo', 'Cakes', 'Chocolate cake with Oreo cookies and mousse', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 480);
  PERFORM public.seed_menu_product('Swiss Oreo', 'Cakes', 'Chocolate cake with Oreo cookies and mousse', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 960);

  PERFORM public.seed_menu_product('Chocolate Walrus', 'Cakes', 'Chocolate mousse cake with walnut', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 90);
  PERFORM public.seed_menu_product('Chocolate Walrus', 'Cakes', 'Chocolate mousse cake with walnut', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 480);
  PERFORM public.seed_menu_product('Chocolate Walrus', 'Cakes', 'Chocolate mousse cake with walnut', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 960);

  PERFORM public.seed_menu_product('Chocolate Chip Mousse Cake', 'Cakes', 'Chocolate mousse cake topped with Hershey\'s kisses', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 480);
  PERFORM public.seed_menu_product('Chocolate Chip Mousse Cake', 'Cakes', 'Chocolate mousse cake topped with Hershey\'s kisses', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 960);

  PERFORM public.seed_menu_product('Belgian Ombre', 'Cakes', 'Classic Chocolate Mousse cake with dark chocolate', '0.5 KG', 0.5, 'HALF_KG', 'WEIGHT_VARIANT', 690);
  PERFORM public.seed_menu_product('Belgian Ombre', 'Cakes', 'Classic Chocolate Mousse cake with dark chocolate', '1 KG', 1, 'KG', 'WEIGHT_VARIANT', 1380);

  -- ====================================================================
  -- 11. SPECIAL DESSERTS
  -- ====================================================================
  PERFORM public.seed_menu_product('Chocolate Mousse', 'Desserts', 'Rich chocolate mousse cup', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Chocolate Candy', 'Desserts', 'Rich chocolate candy', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);
  PERFORM public.seed_menu_product('Choco Lava', 'Desserts', 'Molten choco lava cake', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 70);
  PERFORM public.seed_menu_product('Chocolate Ball', 'Desserts', 'Chocolate truffle ball', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 55);
  PERFORM public.seed_menu_product('Doughnut', 'Desserts', 'Glazed chocolate doughnut', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 55);

  -- ====================================================================
  -- 12. SAVOURIES
  -- ====================================================================
  PERFORM public.seed_menu_product('Puff Veg', 'Savouries', 'Crispy veg puff pastry', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 25);
  PERFORM public.seed_menu_product('Roll Veg Spicy', 'Savouries', 'Spicy veg roll', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 25);
  PERFORM public.seed_menu_product('Burger Veg', 'Savouries', 'Delicious veg burger', '1 Piece', 1, 'PIECE', 'FIXED_PER_UNIT', 55);

  -- ====================================================================
  -- 13. OPERATIONAL ITEMS (Packaging, Utensils)
  -- ====================================================================
  PERFORM public.seed_menu_product('Paper Plate', 'Utensils', 'Eco-friendly paper plate', '1 Pc', 1, 'PIECE', 'FIXED_PER_UNIT', 2);
  PERFORM public.seed_menu_product('Cake Knife', 'Utensils', 'Plastic cake cutting knife', '1 Pc', 1, 'PIECE', 'FIXED_PER_UNIT', 5);
  PERFORM public.seed_menu_product('Candle Set', 'Utensils', 'Birthday candle set', '1 Pack', 1, 'BOX', 'FIXED_PER_UNIT', 10);
  PERFORM public.seed_menu_product('Small Cake Box', 'Packaging', 'Small cake box 0.5 kg', '1 Box', 1, 'BOX', 'FIXED_PER_UNIT', 15);
  PERFORM public.seed_menu_product('Large Cake Box', 'Packaging', 'Large cake box 1 kg', '1 Box', 1, 'BOX', 'FIXED_PER_UNIT', 25);

  -- ====================================================================
  -- 14. CUSTOM CAKE (MANUAL CUSTOM PRICING AT SALE/ORDER TIME)
  -- ====================================================================
  PERFORM public.seed_menu_product('Custom Cake', 'Cakes', 'Custom design, shape, photo, 3D or fondant cake with manually entered price per order/sale', 'Custom Order', 1, 'OTHER', 'CUSTOM', NULL);

END $$;

-- Drop helper function after seeding
DROP FUNCTION IF EXISTS public.seed_menu_product(TEXT, public.product_category, TEXT, TEXT, NUMERIC, public.quantity_unit, public.pricing_type, NUMERIC);

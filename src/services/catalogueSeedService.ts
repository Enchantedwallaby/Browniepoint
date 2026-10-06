import { supabase } from '@/lib/supabase';
import type { ProductCategory, QuantityUnit, PricingType } from '@/types/database';

export interface SeedProductItem {
  name: string;
  category: ProductCategory;
  description: string;
  variant_name: string;
  quantity_value: number;
  quantity_unit: QuantityUnit;
  pricing_type: PricingType;
  base_price: number | null;
}

export const OFFICIAL_MENU_SEED: SeedProductItem[] = [
  // ====================================================================
  // 1. CHEESE CAKES
  // ====================================================================
  { name: 'Strawberry Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with strawberry topping', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Strawberry Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with strawberry topping', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 490 },
  { name: 'Strawberry Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with strawberry topping', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 980 },

  { name: 'Chocolate Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with chocolate', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Chocolate Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with chocolate', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 490 },
  { name: 'Chocolate Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with chocolate', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 980 },

  { name: 'Lemon Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with lemon', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Lemon Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with lemon', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 490 },
  { name: 'Lemon Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with lemon', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 980 },

  { name: 'Mango Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with mango', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Mango Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with mango', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 490 },
  { name: 'Mango Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with mango', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 980 },

  { name: 'Blue Berry Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with blueberry', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Blue Berry Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with blueberry', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 490 },
  { name: 'Blue Berry Cheesecake', category: 'Cheese Cakes', description: 'Gooey Ricotta cheese cake with blueberry', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 980 },

  { name: 'Red Velvet Cheese Cake', category: 'Cheese Cakes', description: 'Rich Cheese caked embedded with luscious cubes of Red Velvet Cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 490 },
  { name: 'Red Velvet Cheese Cake', category: 'Cheese Cakes', description: 'Rich Cheese caked embedded with luscious cubes of Red Velvet Cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 980 },

  // ====================================================================
  // 2. SUGAR FREE CAKES
  // ====================================================================
  { name: 'Chocolate Truffle Sugar Free', category: 'Sugar Free Cakes', description: 'Eggless sugar free chocolate truffle cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 700 },
  { name: 'Chocolate Truffle Sugar Free', category: 'Sugar Free Cakes', description: 'Eggless sugar free chocolate truffle cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1400 },

  { name: 'Chocolate Walnut Sugar Free', category: 'Sugar Free Cakes', description: 'Sugar free chocolate walnut cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 750 },
  { name: 'Chocolate Walnut Sugar Free', category: 'Sugar Free Cakes', description: 'Sugar free chocolate walnut cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1500 },

  { name: 'Chocolate Almond Sugar Free', category: 'Sugar Free Cakes', description: 'Sugar free chocolate almond cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 750 },
  { name: 'Chocolate Almond Sugar Free', category: 'Sugar Free Cakes', description: 'Sugar free chocolate almond cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1500 },

  // ====================================================================
  // 3. TEA-TIME CAKES & BAKERY
  // ====================================================================
  { name: 'Banana Walnut', category: 'Tea-Time Cakes', description: 'Fresh banana walnut tea cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 140 },
  { name: 'Date Walnut', category: 'Tea-Time Cakes', description: 'Date and walnut tea cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 140 },
  { name: 'Plum', category: 'Tea-Time Cakes', description: 'Classic plum cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 140 },
  { name: 'Chocolate Walnut', category: 'Tea-Time Cakes', description: 'Chocolate walnut tea cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 140 },
  { name: 'Chocolate Vanilla', category: 'Tea-Time Cakes', description: 'Marble chocolate vanilla tea cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 140 },
  { name: 'Red Velvet Tea Cake', category: 'Tea-Time Cakes', description: 'Red velvet tea cake loaf', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 140 },
  { name: 'Vanilla Tea Cake', category: 'Tea-Time Cakes', description: 'Classic vanilla tea cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 140 },
  { name: 'Plain Toast', category: 'Tea-Time Cakes', description: 'Crispy plain rusk toast', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 45 },
  { name: 'Jeera Toast / Masala Toast', category: 'Tea-Time Cakes', description: 'Flavoured toast pack', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 50 },
  { name: 'Cake Toast', category: 'Tea-Time Cakes', description: 'Sweet cake toast pack', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Plain Khari', category: 'Tea-Time Cakes', description: 'Crispy puff khari', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 45 },
  { name: 'Masala Khari', category: 'Tea-Time Cakes', description: 'Masala / Methi / Jeera / Kothmir khari', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Sugar Khari', category: 'Tea-Time Cakes', description: 'Sweet sugar glazed khari', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Chilly / Sesame Toast', category: 'Tea-Time Cakes', description: 'Chilly sesame toast pack', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 95 },

  // ====================================================================
  // 4. COOKIES & BREADS
  // ====================================================================
  { name: 'Red Velvet Cookies', category: 'Cookies', description: 'Red velvet cookie pack', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Tutti Frutti Cookies', category: 'Cookies', description: 'Tutti frutti cookie pack', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Chocolate Chips Cookies', category: 'Cookies', description: 'Choco chip cookies', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Nankhatai', category: 'Cookies', description: 'Traditional nankhatai cookies', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Butter Cookies', category: 'Cookies', description: 'Rich butter cookies', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 85 },
  { name: 'Double Chocolate Cookies', category: 'Cookies', description: 'Double chocolate cookies', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 85 },
  { name: 'Kesar Pista Cookies', category: 'Cookies', description: 'Saffron pistachio cookies', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 85 },
  { name: 'Plain Cookies', category: 'Cookies', description: 'Classic plain cookies', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Jeera Cookies', category: 'Cookies', description: 'Cumin jeera cookies', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 60 },
  { name: 'Ajwain Cookies', category: 'Cookies', description: 'Ajwain cookies', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 60 },
  { name: 'Garlic Cookies', category: 'Cookies', description: 'Garlic savoury cookies', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 60 },
  { name: 'Mixed Herb Cookies', category: 'Cookies', description: 'Mixed herb cookies', variant_name: '1 Packet', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 60 },
  { name: 'Burger Buns', category: 'Cookies', description: 'Fresh burger buns pack', variant_name: '1 Pack', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 28 },
  { name: 'Ladi Pav', category: 'Cookies', description: 'Fresh ladi pav pack', variant_name: '1 Pack', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 38 },
  { name: 'Pizza Base', category: 'Cookies', description: 'Fresh pizza base pack Small / Big', variant_name: '1 Pack', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 43 },
  { name: 'Garlic Bread', category: 'Cookies', description: 'Garlic bread loaf', variant_name: '1 Loaf', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Kulcha Bread', category: 'Cookies', description: 'Fresh kulcha bread pack', variant_name: '1 Pack', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Multigrain Bread', category: 'Cookies', description: 'Healthy multigrain bread loaf', variant_name: '1 Loaf', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },

  // ====================================================================
  // 5. BROWNIES
  // ====================================================================
  { name: 'Chocolate Brownie', category: 'Brownies', description: 'Classic dense American gooey brownie', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 65 },
  { name: 'Chocolate Brownie', category: 'Brownies', description: 'Classic dense American gooey brownie', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 700 },

  { name: 'Chocolate Walnut Brownie', category: 'Brownies', description: 'Chocolate brownie with walnuts', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },
  { name: 'Chocolate Walnut Brownie', category: 'Brownies', description: 'Chocolate brownie with walnuts', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 750 },

  { name: 'Chocolate Fudge Brownie', category: 'Brownies', description: 'Fudge chocolate brownie', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Chocolate Fudge Brownie', category: 'Brownies', description: 'Fudge chocolate brownie', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 800 },

  { name: 'Swiss Brownie', category: 'Brownies', description: 'Swiss chocolate brownie', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 80 },
  { name: 'Swiss Brownie', category: 'Brownies', description: 'Swiss chocolate brownie', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 900 },

  { name: 'Walnut Fudge Brownie', category: 'Brownies', description: 'Walnut fudge brownie', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 80 },
  { name: 'Walnut Fudge Brownie', category: 'Brownies', description: 'Walnut fudge brownie', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 900 },

  { name: 'Kitkat Brownie', category: 'Brownies', description: 'Kitkat topped brownie', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 80 },
  { name: 'Kitkat Brownie', category: 'Brownies', description: 'Kitkat topped brownie', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 900 },

  { name: 'Hazelnut Brownie', category: 'Brownies', description: 'Hazelnut chocolate brownie', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 80 },
  { name: 'Hazelnut Brownie', category: 'Brownies', description: 'Hazelnut chocolate brownie', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 900 },

  { name: 'Chunky Hazelnut Brownie', category: 'Brownies', description: 'Chunky hazelnut brownie', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 85 },
  { name: 'Chunky Hazelnut Brownie', category: 'Brownies', description: 'Chunky hazelnut brownie', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 950 },

  { name: 'Chocolate Emperor Brownie', category: 'Brownies', description: 'Emperor chocolate brownie', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 85 },
  { name: 'Chocolate Emperor Brownie', category: 'Brownies', description: 'Emperor chocolate brownie', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 950 },

  { name: 'Chocolate Ferrero Brownie', category: 'Brownies', description: 'Ferrero Rocher brownie', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 85 },
  { name: 'Chocolate Ferrero Brownie', category: 'Brownies', description: 'Ferrero Rocher brownie', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 950 },

  { name: 'Chocolate Overload Brownie', category: 'Brownies', description: 'Ultimate chocolate overload brownie', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 100 },
  { name: 'Chocolate Overload Brownie', category: 'Brownies', description: 'Ultimate chocolate overload brownie', variant_name: 'Large Tray', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 1050 },

  // ====================================================================
  // 6. MACAROONS
  // ====================================================================
  { name: 'Chocolate Macaron', category: 'Macarons', description: 'Classic French Macaroon - Chocolate', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 50 },
  { name: 'Lavender Macaron', category: 'Macarons', description: 'Classic French Macaroon - Lavender', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 50 },
  { name: 'Coffee Macaron', category: 'Macarons', description: 'Classic French Macaroon - Coffee', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 50 },
  { name: 'Strawberry Macaron', category: 'Macarons', description: 'Classic French Macaroon - Strawberry', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 50 },
  { name: 'Cotton Candy Macaron', category: 'Macarons', description: 'Classic French Macaroon - Cotton Candy', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 50 },

  // ====================================================================
  // 7. CUP CAKES
  // ====================================================================
  { name: 'Vanilla Cupcake', category: 'Cup Cakes', description: 'Vanilla cupcake topped with butter cream', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 50 },
  { name: 'Chocolate Cupcake', category: 'Cup Cakes', description: 'Chocolate cupcake topped with butter cream', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Chocolate Truffle Cupcake', category: 'Cup Cakes', description: 'Rich chocolate truffle cupcake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },
  { name: 'Oreo Cupcake', category: 'Cup Cakes', description: 'Oreo topped cupcake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },
  { name: 'Black Forest Cupcake', category: 'Cup Cakes', description: 'Black forest cupcake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },
  { name: 'Kit Kat Cupcake', category: 'Cup Cakes', description: 'Kit Kat topped cupcake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },
  { name: 'Red Velvet Cupcake', category: 'Cup Cakes', description: 'Red velvet cupcake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },

  // ====================================================================
  // 8. CAKES - CREAM / FRUIT BASED
  // ====================================================================
  { name: 'Vanilla', category: 'Cakes', description: 'Classic vanilla fresh cream cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 249 },
  { name: 'Vanilla', category: 'Cakes', description: 'Classic vanilla fresh cream cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 498 },

  { name: 'Strawberry Forest', category: 'Cakes', description: 'Gateau with strawberry cream and chocolate', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 295 },
  { name: 'Strawberry Forest', category: 'Cakes', description: 'Gateau with strawberry cream and chocolate', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 590 },

  { name: 'Orange Forest', category: 'Cakes', description: 'Orange cream and chocolate combo', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 295 },
  { name: 'Orange Forest', category: 'Cakes', description: 'Orange cream and chocolate combo', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 590 },

  { name: 'Caramel Coffee', category: 'Cakes', description: 'Caramel and coffee cream cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 295 },
  { name: 'Caramel Coffee', category: 'Cakes', description: 'Caramel and coffee cream cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 670 },

  { name: 'Black Currant', category: 'Cakes', description: 'Black currant fresh cream cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 320 },
  { name: 'Black Currant', category: 'Cakes', description: 'Black currant fresh cream cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 640 },

  { name: 'Black Jamun', category: 'Cakes', description: 'Black jamun flavoured cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 339 },
  { name: 'Black Jamun', category: 'Cakes', description: 'Black jamun flavoured cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 670 },

  { name: 'Chikku', category: 'Cakes', description: 'Chikku fruit cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 350 },
  { name: 'Chikku', category: 'Cakes', description: 'Chikku fruit cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 700 },

  { name: 'Kiwi', category: 'Cakes', description: 'Fresh kiwi cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 380 },
  { name: 'Kiwi', category: 'Cakes', description: 'Fresh kiwi cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 760 },

  { name: 'Mango Delight', category: 'Cakes', description: 'Round shaped mango cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Mango Delight', category: 'Cakes', description: 'Round shaped mango cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 340 },
  { name: 'Mango Delight', category: 'Cakes', description: 'Round shaped mango cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 680 },

  { name: 'Blueberry Delight', category: 'Cakes', description: 'Round shaped blueberry cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Blueberry Delight', category: 'Cakes', description: 'Round shaped blueberry cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 340 },
  { name: 'Blueberry Delight', category: 'Cakes', description: 'Round shaped blueberry cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 680 },

  { name: 'Strawberry Delight', category: 'Cakes', description: 'Round shaped strawberry cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Strawberry Delight', category: 'Cakes', description: 'Round shaped strawberry cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 340 },
  { name: 'Strawberry Delight', category: 'Cakes', description: 'Round shaped strawberry cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 680 },

  { name: 'Ebony Ivory Cake', category: 'Cakes', description: 'Dual chocolate Ebony Ivory cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 370 },
  { name: 'Ebony Ivory Cake', category: 'Cakes', description: 'Dual chocolate Ebony Ivory cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 740 },

  { name: 'Caramel Butterscotch', category: 'Cakes', description: 'Rich caramel butterscotch cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 375 },
  { name: 'Caramel Butterscotch', category: 'Cakes', description: 'Rich caramel butterscotch cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 750 },

  { name: 'Butterscotch', category: 'Cakes', description: 'Classic butterscotch fresh cream cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 375 },
  { name: 'Butterscotch', category: 'Cakes', description: 'Classic butterscotch fresh cream cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 750 },

  { name: 'Black Forest', category: 'Cakes', description: 'Classic Black Forest with layers of fresh cream & cherry flakes', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Black Forest', category: 'Cakes', description: 'Classic Black Forest with layers of fresh cream & cherry flakes', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 380 },
  { name: 'Black Forest', category: 'Cakes', description: 'Classic Black Forest with layers of fresh cream & cherry flakes', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 730 },

  { name: 'Fresh Pineapple', category: 'Cakes', description: 'Fresh cream and pineapple cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Fresh Pineapple', category: 'Cakes', description: 'Fresh cream and pineapple cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 380 },
  { name: 'Fresh Pineapple', category: 'Cakes', description: 'Fresh cream and pineapple cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 730 },

  { name: 'Tender Coconut', category: 'Cakes', description: 'Fresh tender coconut cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 400 },
  { name: 'Tender Coconut', category: 'Cakes', description: 'Fresh tender coconut cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 800 },

  { name: 'Custard Apple', category: 'Cakes', description: 'Fresh custard apple cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 470 },
  { name: 'Custard Apple', category: 'Cakes', description: 'Fresh custard apple cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 940 },

  { name: 'Lotus Biscoff', category: 'Cakes', description: 'Lotus Biscoff speculoos cream cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 650 },
  { name: 'Lotus Biscoff', category: 'Cakes', description: 'Lotus Biscoff speculoos cream cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1300 },

  { name: 'Chilly Guava Cake', category: 'Cakes', description: 'Chilly guava flavoured cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 365 },
  { name: 'Chilly Guava Cake', category: 'Cakes', description: 'Chilly guava flavoured cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 730 },

  { name: 'Cream Nougat', category: 'Cakes', description: 'Cream nougat fresh cream cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },
  { name: 'Cream Nougat', category: 'Cakes', description: 'Cream nougat fresh cream cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 375 },
  { name: 'Cream Nougat', category: 'Cakes', description: 'Cream nougat fresh cream cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 750 },

  { name: 'Royal Falooda Cake', category: 'Cakes', description: 'Falooda flavoured fresh cream cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 415 },
  { name: 'Royal Falooda Cake', category: 'Cakes', description: 'Falooda flavoured fresh cream cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 830 },

  { name: 'Mixed Fruit Gateau', category: 'Cakes', description: 'Mixed fruit fresh cream and crunchy almonds', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 85 },
  { name: 'Mixed Fruit Gateau', category: 'Cakes', description: 'Mixed fruit fresh cream and crunchy almonds', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 440 },
  { name: 'Mixed Fruit Gateau', category: 'Cakes', description: 'Mixed fruit fresh cream and crunchy almonds', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 880 },

  { name: 'Rasmalai Fresh Cream', category: 'Cakes', description: 'Thandai flavoured cream cake with fresh rasmalai', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Rasmalai Fresh Cream', category: 'Cakes', description: 'Thandai flavoured cream cake with fresh rasmalai', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 470 },
  { name: 'Rasmalai Fresh Cream', category: 'Cakes', description: 'Thandai flavoured cream cake with fresh rasmalai', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 940 },

  { name: 'Gulab Jamun Fresh Cream', category: 'Cakes', description: 'Thandai cream cake with gulab jamun pcs', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 470 },
  { name: 'Gulab Jamun Fresh Cream', category: 'Cakes', description: 'Thandai cream cake with gulab jamun pcs', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 940 },

  { name: 'Motichoor Rabdi', category: 'Cakes', description: 'Saffron cream cake with pearls of Motichoor Rabdi', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 470 },
  { name: 'Motichoor Rabdi', category: 'Cakes', description: 'Saffron cream cake with pearls of Motichoor Rabdi', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 940 },

  { name: 'Fresh Mango', category: 'Cakes', description: 'Classic vanilla and fresh mango cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 470 },
  { name: 'Fresh Mango', category: 'Cakes', description: 'Classic vanilla and fresh mango cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 940 },

  { name: 'Red Velvet', category: 'Cakes', description: 'Classic Red Velvet cake with cream cheese frosting', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Red Velvet', category: 'Cakes', description: 'Classic Red Velvet cake with cream cheese frosting', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 490 },
  { name: 'Red Velvet', category: 'Cakes', description: 'Classic Red Velvet cake with cream cheese frosting', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 980 },

  { name: 'Mixed Fruit Almond', category: 'Cakes', description: 'Mixed fruit cake with crunchy almonds', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },
  { name: 'Mixed Fruit Almond', category: 'Cakes', description: 'Mixed fruit cake with crunchy almonds', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 990 },

  { name: 'Saffron Tres Leche Cake', category: 'Cakes', description: 'Saffron tres leche milk cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 550 },
  { name: 'Saffron Tres Leche Cake', category: 'Cakes', description: 'Saffron tres leche milk cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1100 },

  { name: 'Fruit Exotic Cake', category: 'Cakes', description: 'Exotic fresh fruit cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 550 },
  { name: 'Fruit Exotic Cake', category: 'Cakes', description: 'Exotic fresh fruit cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1100 },

  { name: 'Fresh Strawberry Almond', category: 'Cakes', description: 'Fresh strawberry cake with crunchy almonds', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 530 },
  { name: 'Fresh Strawberry Almond', category: 'Cakes', description: 'Fresh strawberry cake with crunchy almonds', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1060 },

  { name: 'Fresh Mango Almond Cake', category: 'Cakes', description: 'Fresh mango cake with crunchy almonds', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 530 },
  { name: 'Fresh Mango Almond Cake', category: 'Cakes', description: 'Fresh mango cake with crunchy almonds', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1060 },

  { name: 'Tiramisu', category: 'Cakes', description: 'Classic coffee tiramisu cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 550 },
  { name: 'Tiramisu', category: 'Cakes', description: 'Classic coffee tiramisu cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1100 },

  { name: 'Mango Maharaja', category: 'Cakes', description: 'Premium mango cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 620 },
  { name: 'Mango Maharaja', category: 'Cakes', description: 'Premium mango cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1240 },

  { name: 'Rainbow Cake', category: 'Cakes', description: 'Vanilla cake with rainbow coloured fruit flavoured cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 650 },
  { name: 'Rainbow Cake', category: 'Cakes', description: 'Vanilla cake with rainbow coloured fruit flavoured cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1300 },

  // ====================================================================
  // 9. CAKES - CHOCOLATE BASED
  // ====================================================================
  { name: 'Choco Light', category: 'Cakes', description: 'Light chocolate cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 249 },
  { name: 'Choco Light', category: 'Cakes', description: 'Light chocolate cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 498 },

  { name: 'Choco Strips', category: 'Cakes', description: 'Chocolate base with chocolate strips', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 249 },
  { name: 'Choco Strips', category: 'Cakes', description: 'Chocolate base with chocolate strips', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 498 },

  { name: 'Chocolate Flake', category: 'Cakes', description: 'Creamy chocolate and chocolate flakes', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 355 },
  { name: 'Chocolate Flake', category: 'Cakes', description: 'Creamy chocolate and chocolate flakes', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 670 },

  { name: 'Choco Marble', category: 'Cakes', description: 'Marble chocolate cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 350 },
  { name: 'Choco Marble', category: 'Cakes', description: 'Marble chocolate cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 700 },

  { name: 'Choco Vanilla', category: 'Cakes', description: 'Choco vanilla combo cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 350 },
  { name: 'Choco Vanilla', category: 'Cakes', description: 'Choco vanilla combo cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 700 },

  { name: 'Choco Cream Cake', category: 'Cakes', description: 'Chocolate cream cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 390 },
  { name: 'Choco Cream Cake', category: 'Cakes', description: 'Chocolate cream cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 780 },

  { name: 'Regal Chocolate', category: 'Cakes', description: 'Chocolate cake with chocolate drizzle', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },
  { name: 'Regal Chocolate', category: 'Cakes', description: 'Chocolate cake with chocolate drizzle', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 380 },
  { name: 'Regal Chocolate', category: 'Cakes', description: 'Chocolate cake with chocolate drizzle', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 760 },

  { name: 'Chocolate Delight Cake', category: 'Cakes', description: 'Rich chocolate delight cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 380 },
  { name: 'Chocolate Delight Cake', category: 'Cakes', description: 'Rich chocolate delight cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 760 },

  { name: 'Royal Chocolate Cream Cake', category: 'Cakes', description: 'Royal chocolate cream cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 380 },
  { name: 'Royal Chocolate Cream Cake', category: 'Cakes', description: 'Royal chocolate cream cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 760 },

  { name: 'Choco Cream Nougat', category: 'Cakes', description: 'Chocolate cream nougat cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },
  { name: 'Choco Cream Nougat', category: 'Cakes', description: 'Chocolate cream nougat cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 380 },
  { name: 'Choco Cream Nougat', category: 'Cakes', description: 'Chocolate cream nougat cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 760 },

  { name: 'Choco Vanilla Trio Cake', category: 'Cakes', description: 'Choco vanilla trio layered cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Choco Vanilla Trio Cake', category: 'Cakes', description: 'Choco vanilla trio layered cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 390 },
  { name: 'Choco Vanilla Trio Cake', category: 'Cakes', description: 'Choco vanilla trio layered cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 780 },

  { name: 'Chocolate Mocha Caramel', category: 'Cakes', description: 'Coffee, caramel and chocolate cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 390 },
  { name: 'Chocolate Mocha Caramel', category: 'Cakes', description: 'Coffee, caramel and chocolate cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 780 },

  { name: 'Chocolate Chips', category: 'Cakes', description: 'Chocolate cream and chips cake with chocolate drizzle', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Chocolate Chips', category: 'Cakes', description: 'Chocolate cream and chips cake with chocolate drizzle', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 390 },
  { name: 'Chocolate Chips', category: 'Cakes', description: 'Chocolate cream and chips cake with chocolate drizzle', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 780 },

  { name: 'Chocolate Cream Truffle', category: 'Cakes', description: 'Chocolate cream truffle cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 410 },
  { name: 'Chocolate Cream Truffle', category: 'Cakes', description: 'Chocolate cream truffle cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 820 },

  { name: 'Dark Chocolate Crinkle', category: 'Cakes', description: 'Dark chocolate crinkle cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 390 },
  { name: 'Dark Chocolate Crinkle', category: 'Cakes', description: 'Dark chocolate crinkle cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 780 },

  { name: 'Milk Chocolate Crinkle', category: 'Cakes', description: 'Milk chocolate crinkle cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 390 },
  { name: 'Milk Chocolate Crinkle', category: 'Cakes', description: 'Milk chocolate crinkle cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 780 },

  { name: 'Chocolate Cream Crunchy', category: 'Cakes', description: 'Chocolate crunchy cake with chocolate cream swirls', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 420 },
  { name: 'Chocolate Cream Crunchy', category: 'Cakes', description: 'Chocolate crunchy cake with chocolate cream swirls', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 840 },

  { name: 'Dutch Truffle', category: 'Cakes', description: 'The classic Dutch chocolate cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 80 },
  { name: 'Dutch Truffle', category: 'Cakes', description: 'The classic Dutch chocolate cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 440 },
  { name: 'Dutch Truffle', category: 'Cakes', description: 'The classic Dutch chocolate cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 880 },

  { name: 'Opera Cake', category: 'Cakes', description: 'Vanilla cake layered with coffee cream and chocolate ganache', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 75 },
  { name: 'Opera Cake', category: 'Cakes', description: 'Vanilla cake layered with coffee cream and chocolate ganache', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 440 },
  { name: 'Opera Cake', category: 'Cakes', description: 'Vanilla cake layered with coffee cream and chocolate ganache', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 880 },

  { name: 'Zebra Torte Cake', category: 'Cakes', description: 'Zebra torte chocolate cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 460 },
  { name: 'Zebra Torte Cake', category: 'Cakes', description: 'Zebra torte chocolate cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 920 },

  { name: 'Caramel Zebra', category: 'Cakes', description: 'Chocolate and caramel cream cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 450 },
  { name: 'Caramel Zebra', category: 'Cakes', description: 'Chocolate and caramel cream cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 900 },

  { name: 'Chocolate Caramel', category: 'Cakes', description: 'Chocolate & caramel cake with butterscotch', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 80 },
  { name: 'Chocolate Caramel', category: 'Cakes', description: 'Chocolate & caramel cake with butterscotch', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 470 },
  { name: 'Chocolate Caramel', category: 'Cakes', description: 'Chocolate & caramel cake with butterscotch', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 940 },

  { name: 'Choco Truffle', category: 'Cakes', description: 'Rich chocolate truffle cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 450 },
  { name: 'Choco Truffle', category: 'Cakes', description: 'Rich chocolate truffle cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 900 },

  { name: '50 / 50', category: 'Cakes', description: 'Half Chocolate and Half Fruit cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 480 },
  { name: '50 / 50', category: 'Cakes', description: 'Half Chocolate and Half Fruit cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 960 },

  { name: 'Kitkat Gateau', category: 'Cakes', description: 'Dark chocolate cake with Kit Kat fillings and toppings', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 480 },
  { name: 'Kitkat Gateau', category: 'Cakes', description: 'Dark chocolate cake with Kit Kat fillings and toppings', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 960 },

  { name: 'Rich Walnut', category: 'Cakes', description: 'Classic chocolate cake for walnut lovers', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Rich Walnut', category: 'Cakes', description: 'Classic chocolate cake for walnut lovers', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },
  { name: 'Rich Walnut', category: 'Cakes', description: 'Classic chocolate cake for walnut lovers', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 990 },

  { name: 'Rich Almond', category: 'Cakes', description: 'Rich chocolate and almond cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Rich Almond', category: 'Cakes', description: 'Rich chocolate and almond cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },
  { name: 'Rich Almond', category: 'Cakes', description: 'Rich chocolate and almond cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 990 },

  { name: 'Chocolate Fantasy', category: 'Cakes', description: 'Rich chocolate cake with almonds, hazelnut, walnuts and nougat', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },
  { name: 'Chocolate Fantasy', category: 'Cakes', description: 'Rich chocolate cake with almonds, hazelnut, walnuts and nougat', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 990 },

  { name: 'Chocolate Hazelnut Cake', category: 'Cakes', description: 'Chocolate ganache cake with crunchy hazelnuts', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },
  { name: 'Chocolate Hazelnut Cake', category: 'Cakes', description: 'Chocolate ganache cake with crunchy hazelnuts', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 990 },

  { name: 'Swiss Truffle', category: 'Cakes', description: 'Chocolate cake with layers of chocolate cream, chips and flakes', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Swiss Truffle', category: 'Cakes', description: 'Chocolate cake with layers of chocolate cream, chips and flakes', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },
  { name: 'Swiss Truffle', category: 'Cakes', description: 'Chocolate cake with layers of chocolate cream, chips and flakes', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 990 },

  { name: 'Belgian Nougat', category: 'Cakes', description: 'Dark Belgian chocolate with crunchy nougat and dark ganache', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Belgian Nougat', category: 'Cakes', description: 'Dark Belgian chocolate with crunchy nougat and dark ganache', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },
  { name: 'Belgian Nougat', category: 'Cakes', description: 'Dark Belgian chocolate with crunchy nougat and dark ganache', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 990 },

  { name: 'Choc. Short Cakes', category: 'Cakes', description: 'Dense chocolate cake with layers of caramel and chocolate mousse', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Choc. Short Cakes', category: 'Cakes', description: 'Dense chocolate cake with layers of caramel and chocolate mousse', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },
  { name: 'Choc. Short Cakes', category: 'Cakes', description: 'Dense chocolate cake with layers of caramel and chocolate mousse', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 990 },

  { name: 'Summer Surprise Cream Cake', category: 'Cakes', description: 'Mango & strawberry cake with colorful cream rosettes', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },
  { name: 'Summer Surprise Cream Cake', category: 'Cakes', description: 'Mango & strawberry cake with colorful cream rosettes', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 990 },

  { name: 'Chocolate Hazelnut Nougat Torte', category: 'Cakes', description: 'Rich Belgian chocolate cake with hazelnut and nougat', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },
  { name: 'Chocolate Hazelnut Nougat Torte', category: 'Cakes', description: 'Rich Belgian chocolate cake with hazelnut and nougat', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 990 },

  { name: 'Belgian Hazelnut Cake', category: 'Cakes', description: 'Belgian hazelnut chocolate cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 540 },
  { name: 'Belgian Hazelnut Cake', category: 'Cakes', description: 'Belgian hazelnut chocolate cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1080 },

  { name: 'Caramel Fruit Cake', category: 'Cakes', description: 'Caramel and fruit cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 500 },
  { name: 'Caramel Fruit Cake', category: 'Cakes', description: 'Caramel and fruit cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1000 },

  { name: 'Strawberry Chocolate', category: 'Cakes', description: 'Chocolate truffle with strawberries', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 95 },
  { name: 'Strawberry Chocolate', category: 'Cakes', description: 'Chocolate truffle with strawberries', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 520 },
  { name: 'Strawberry Chocolate', category: 'Cakes', description: 'Chocolate truffle with strawberries', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1040 },

  { name: 'Chocolate Mango Cake', category: 'Cakes', description: 'Chocolate truffle with mangoes', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 520 },
  { name: 'Chocolate Mango Cake', category: 'Cakes', description: 'Chocolate truffle with mangoes', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1040 },

  { name: 'Grandma Choco Cake', category: 'Cakes', description: 'Classic buttermilk dark chocolate cake with chocolate ganache', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 670 },
  { name: 'Grandma Choco Cake', category: 'Cakes', description: 'Classic buttermilk dark chocolate cake with chocolate ganache', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1140 },

  { name: 'Double Chocolate Cake', category: 'Cakes', description: 'Trio of chocolate cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 550 },
  { name: 'Double Chocolate Cake', category: 'Cakes', description: 'Trio of chocolate cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1100 },

  { name: 'Trio of Chocolate Cake', category: 'Cakes', description: 'Trio of dark, milk and white chocolate', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 550 },
  { name: 'Trio of Chocolate Cake', category: 'Cakes', description: 'Trio of dark, milk and white chocolate', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1100 },

  { name: 'Bailey\'s Poke Cake', category: 'Cakes', description: 'Bailey\'s Irish cream poke cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 600 },
  { name: 'Bailey\'s Poke Cake', category: 'Cakes', description: 'Bailey\'s Irish cream poke cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1200 },

  { name: 'Ferraro Rocher Cake', category: 'Cakes', description: 'Dark chocolate embedded with chopped Ferrero Rocher', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 650 },
  { name: 'Ferraro Rocher Cake', category: 'Cakes', description: 'Dark chocolate embedded with chopped Ferrero Rocher', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1300 },

  { name: 'Premium Kitkat', category: 'Cakes', description: 'Rich Dutch truffle cake with Kitkat', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 650 },
  { name: 'Premium Kitkat', category: 'Cakes', description: 'Rich Dutch truffle cake with Kitkat', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1300 },

  { name: 'Chocolate Shard Cake', category: 'Cakes', description: 'Chocolate shard decorated cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 650 },
  { name: 'Chocolate Shard Cake', category: 'Cakes', description: 'Chocolate shard decorated cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1300 },

  { name: 'Pull me up Cake', category: 'Cakes', description: 'Chocolate & caramel cake with dripping chocolate sauce & brownie nut topping', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 700 },
  { name: 'Pull me up Cake', category: 'Cakes', description: 'Chocolate & caramel cake with dripping chocolate sauce & brownie nut topping', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1400 },

  { name: 'Pinata Cake (Heart Shape)', category: 'Cakes', description: 'Chocolate dome with surprise cake inside & hammer', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 750 },

  { name: 'Pinata Cake (Sphere Shape)', category: 'Cakes', description: 'Chocolate sphere dome with surprise cake inside & hammer', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1050 },
  { name: 'Pinata Cake (Sphere Shape)', category: 'Cakes', description: 'Chocolate sphere dome with surprise cake inside & hammer', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1950 },

  { name: 'Scrolling Photo Cake', category: 'Cakes', description: 'Custom photo cake with scrolling photo reel', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1250 },

  { name: 'Surprise Explosion Cake (D/T)', category: 'Cakes', description: 'Explosion surprise box cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1200 },

  { name: 'Surprise Box', category: 'Cakes', description: 'Luxury surprise box cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 2700 },
  { name: 'Surprise Box', category: 'Cakes', description: 'Luxury surprise box cake', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 3500 },

  { name: 'German Black Forest', category: 'Cakes', description: 'German style Black Forest cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 399 },

  { name: 'Choco Truffle Sugarless', category: 'Cakes', description: 'Sugarless dark chocolate truffle cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 750 },

  { name: 'Choco Hazelnut', category: 'Cakes', description: 'Chocolate hazelnut cake', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 495 },

  // ====================================================================
  // 10. CAKES - MOUSSE BASED
  // ====================================================================
  { name: 'Belgian Mousse Cake', category: 'Cakes', description: 'Belgian mousse topped with chocolate flake & curls', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Belgian Mousse Cake', category: 'Cakes', description: 'Belgian mousse topped with chocolate flake & curls', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 480 },
  { name: 'Belgian Mousse Cake', category: 'Cakes', description: 'Belgian mousse topped with chocolate flake & curls', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 960 },

  { name: 'Death by Chocolate', category: 'Cakes', description: 'Chocolate mousse cake with brownies base, butterscotch & walnut', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Death by Chocolate', category: 'Cakes', description: 'Chocolate mousse cake with brownies base, butterscotch & walnut', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 480 },
  { name: 'Death by Chocolate', category: 'Cakes', description: 'Chocolate mousse cake with brownies base, butterscotch & walnut', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 960 },

  { name: 'Swiss Oreo', category: 'Cakes', description: 'Chocolate cake with Oreo cookies and mousse', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Swiss Oreo', category: 'Cakes', description: 'Chocolate cake with Oreo cookies and mousse', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 480 },
  { name: 'Swiss Oreo', category: 'Cakes', description: 'Chocolate cake with Oreo cookies and mousse', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 960 },

  { name: 'Chocolate Walrus', category: 'Cakes', description: 'Chocolate mousse cake with walnut', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 90 },
  { name: 'Chocolate Walrus', category: 'Cakes', description: 'Chocolate mousse cake with walnut', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 480 },
  { name: 'Chocolate Walrus', category: 'Cakes', description: 'Chocolate mousse cake with walnut', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 960 },

  { name: 'Chocolate Chip Mousse Cake', category: 'Cakes', description: 'Chocolate mousse cake topped with Hershey\'s kisses', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 480 },
  { name: 'Chocolate Chip Mousse Cake', category: 'Cakes', description: 'Chocolate mousse cake topped with Hershey\'s kisses', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 960 },

  { name: 'Belgian Ombre', category: 'Cakes', description: 'Classic Chocolate Mousse cake with dark chocolate', variant_name: '0.5 KG', quantity_value: 0.5, quantity_unit: 'HALF_KG', pricing_type: 'WEIGHT_VARIANT', base_price: 690 },
  { name: 'Belgian Ombre', category: 'Cakes', description: 'Classic Chocolate Mousse cake with dark chocolate', variant_name: '1 KG', quantity_value: 1, quantity_unit: 'KG', pricing_type: 'WEIGHT_VARIANT', base_price: 1380 },

  // ====================================================================
  // 11. SPECIAL DESSERTS
  // ====================================================================
  { name: 'Chocolate Mousse', category: 'Desserts', description: 'Rich chocolate mousse cup', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Chocolate Candy', category: 'Desserts', description: 'Rich chocolate candy', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },
  { name: 'Choco Lava', category: 'Desserts', description: 'Molten choco lava cake', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 70 },
  { name: 'Chocolate Ball', category: 'Desserts', description: 'Chocolate truffle ball', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },
  { name: 'Doughnut', category: 'Desserts', description: 'Glazed chocolate doughnut', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },

  // ====================================================================
  // 12. SAVOURIES
  // ====================================================================
  { name: 'Puff Veg', category: 'Savouries', description: 'Crispy veg puff pastry', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 25 },
  { name: 'Roll Veg Spicy', category: 'Savouries', description: 'Spicy veg roll', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 25 },
  { name: 'Burger Veg', category: 'Savouries', description: 'Delicious veg burger', variant_name: '1 Piece', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 55 },

  // ====================================================================
  // 13. OPERATIONAL ITEMS (Packaging, Utensils)
  // ====================================================================
  { name: 'Paper Plate', category: 'Utensils', description: 'Eco-friendly paper plate', variant_name: '1 Pc', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 2 },
  { name: 'Cake Knife', category: 'Utensils', description: 'Plastic cake cutting knife', variant_name: '1 Pc', quantity_value: 1, quantity_unit: 'PIECE', pricing_type: 'FIXED_PER_UNIT', base_price: 5 },
  { name: 'Candle Set', category: 'Utensils', description: 'Birthday candle set', variant_name: '1 Pack', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 10 },
  { name: 'Small Cake Box', category: 'Packaging', description: 'Small cake box 0.5 kg', variant_name: '1 Box', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 15 },
  { name: 'Large Cake Box', category: 'Packaging', description: 'Large cake box 1 kg', variant_name: '1 Box', quantity_value: 1, quantity_unit: 'BOX', pricing_type: 'FIXED_PER_UNIT', base_price: 25 },

  // ====================================================================
  // 14. CUSTOM CAKE (MANUAL CUSTOM PRICING AT SALE/ORDER TIME)
  // ====================================================================
  { name: 'Custom Cake', category: 'Cakes', description: 'Custom design, shape, photo, 3D or fondant cake with manually entered price per order/sale', variant_name: 'Custom Order', quantity_value: 1, quantity_unit: 'OTHER', pricing_type: 'CUSTOM', base_price: null },
];

export interface ReconciliationReport {
  menuProductsCount: number;
  menuVariantsCount: number;
  insertedProducts: number;
  insertedVariants: number;
  correctedPrices: number;
  customProductsCount: number;
  errorsCount: number;
}

export const catalogueSeedService = {
  async seedOfficialMenu(): Promise<ReconciliationReport> {
    let insertedProducts = 0;
    let insertedVariants = 0;
    let correctedPrices = 0;
    let customProductsCount = 0;
    let errorsCount = 0;

    const uniqueProductNames = new Set(OFFICIAL_MENU_SEED.map((i) => i.name));

    for (const item of OFFICIAL_MENU_SEED) {
      if (item.pricing_type === 'CUSTOM') {
        customProductsCount++;
      }

      try {
        // 1. Check or insert product (Idempotent)
        let productId: string;
        const { data: existingProd } = await supabase
          .from('products')
          .select('id, category, description')
          .eq('name', item.name)
          .maybeSingle();

        if (existingProd) {
          productId = existingProd.id;
          // Update category or description if mismatched
          if (existingProd.category !== item.category || existingProd.description !== item.description) {
            await supabase
              .from('products')
              .update({ category: item.category, description: item.description })
              .eq('id', productId);
          }
        } else {
          const { data: newProd, error: pErr } = await supabase
            .from('products')
            .insert({
              name: item.name,
              category: item.category,
              description: item.description,
              active: true,
            })
            .select('id')
            .single();

          if (pErr) throw pErr;
          productId = newProd.id;
          insertedProducts++;
        }

        // 2. Check or insert variant (Idempotent)
        let variantId: string;
        const { data: existingVar } = await supabase
          .from('product_variants')
          .select('id, quantity_value, quantity_unit')
          .eq('product_id', productId)
          .eq('name', item.variant_name)
          .maybeSingle();

        if (existingVar) {
          variantId = existingVar.id;
          if (existingVar.quantity_value !== item.quantity_value || existingVar.quantity_unit !== item.quantity_unit) {
            await supabase
              .from('product_variants')
              .update({ quantity_value: item.quantity_value, quantity_unit: item.quantity_unit })
              .eq('id', variantId);
          }
        } else {
          const { data: newVar, error: vErr } = await supabase
            .from('product_variants')
            .insert({
              product_id: productId,
              name: item.variant_name,
              quantity_value: item.quantity_value,
              quantity_unit: item.quantity_unit,
              active: true,
            })
            .select('id')
            .single();

          if (vErr) throw vErr;
          variantId = newVar.id;
          insertedVariants++;
        }

        // 3. Check or insert/update pricing rule (Idempotent & Price Correction)
        const { data: existingRule } = await supabase
          .from('pricing_rules')
          .select('id, pricing_type, base_price')
          .eq('product_variant_id', variantId)
          .eq('active', true)
          .maybeSingle();

        if (existingRule) {
          // If price or pricing_type changed, update to ensure menu accuracy
          if (existingRule.pricing_type !== item.pricing_type || existingRule.base_price !== item.base_price) {
            await supabase
              .from('pricing_rules')
              .update({ pricing_type: item.pricing_type, base_price: item.base_price })
              .eq('id', existingRule.id);
            correctedPrices++;
          }
        } else {
          const { error: prErr } = await supabase.from('pricing_rules').insert({
            product_variant_id: variantId,
            pricing_type: item.pricing_type,
            base_price: item.base_price,
            active: true,
          });

          if (prErr) throw prErr;
        }
      } catch (err) {
        console.error('Error seeding menu item:', item.name, item.variant_name, err);
        errorsCount++;
      }
    }

    return {
      menuProductsCount: uniqueProductNames.size,
      menuVariantsCount: OFFICIAL_MENU_SEED.length,
      insertedProducts,
      insertedVariants,
      correctedPrices,
      customProductsCount,
      errorsCount,
    };
  },
};

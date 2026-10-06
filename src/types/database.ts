/**
 * Database Types for Brownie Point Operations System
 * Matches supabase/migrations/20260930000000_initial_schema.sql
 */

export type UserRole = 'OWNER' | 'MAIN_BRANCH_EMPLOYEE' | 'BRANCH_EMPLOYEE';

export type BranchType = 'MAIN' | 'SUB_BRANCH';

export type ProductCategory =
  | 'Cakes'
  | 'Pastries'
  | 'Brownies'
  | 'Macarons'
  | 'Cup Cakes'
  | 'Desserts'
  | 'Cheese Cakes'
  | 'Sugar Free Cakes'
  | 'Tea-Time Cakes'
  | 'Cookies'
  | 'Savouries'
  | 'Packaging'
  | 'Utensils'
  | 'Consumables'
  | 'Other';

export type QuantityUnit =
  | 'PIECE'
  | 'KG'
  | 'HALF_KG'
  | 'GRAM'
  | 'BOX'
  | 'OTHER';

export type PricingType =
  | 'FIXED_PER_UNIT'
  | 'WEIGHT_VARIANT'
  | 'PER_KG'
  | 'CUSTOM';

export type InventoryMovementType =
  | 'PRODUCTION'
  | 'SALE'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'RETURN_OUT'
  | 'RETURN_IN'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'ADJUSTMENT';

export type PaymentMethod = 'CASH' | 'ONLINE' | 'CARD' | 'UPI' | 'MIXED';

export type SaleStatus = 'COMPLETED' | 'RETURNED' | 'VOIDED';

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'DISPATCHED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ReturnReason = 'RETURN_TO_MAIN' | 'EXPIRED' | 'DAMAGED' | 'ADJUSTMENT';

// ----------------------------------------------------------------
// TABLE INTERFACES
// ----------------------------------------------------------------

export interface Branch {
  id: string;
  name: string;
  branch_code: string;
  branch_type: BranchType;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  branch_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string | null;
  show_weight_size?: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  quantity_value: number;
  quantity_unit: QuantityUnit;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  id: string;
  product_variant_id: string | null;
  pricing_type: PricingType;
  /**
   * NULL only when pricing_type = 'CUSTOM'.
   * For standard menu items this is always set.
   */
  base_price: number | null;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductBatch {
  id: string;
  product_variant_id: string;
  batch_number: string;
  production_date: string;
  expiry_date: string;
  initial_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  branch_id: string;
  product_variant_id: string;
  batch_id: string;
  quantity_available: number;
  quantity_in_transit: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  branch_id: string;
  product_variant_id: string;
  batch_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface ReturnRequest {
  id: string;
  branch_id: string;
  created_by: string;
  product_variant_id: string;
  batch_id: string;
  quantity: number;
  reason: ReturnReason;
  notes: string | null;
  status: ReturnStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/**
 * Sales table.
 * unit_price_snapshot on each sale_item is immutable after insert.
 * Historical records are never affected by pricing rule changes.
 */
export interface Sale {
  id: string;
  branch_id: string;
  sale_date: string;
  total_amount: number;
  discount_amount: number;
  payment_method: PaymentMethod;
  amount_cash: number;
  amount_online: number;
  customer_name: string | null;
  notes: string | null;
  status: SaleStatus;
  performed_by: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Sale Items table.
 * unit_price_snapshot is locked at time of sale.
 * is_custom_price = true means employee manually entered the price (custom cakes).
 */
export interface SaleItem {
  id: string;
  sale_id: string;
  product_variant_id: string;
  batch_id: string | null;
  quantity: number;
  unit_price_snapshot: number;
  line_total: number; // generated column: quantity * unit_price_snapshot
  is_custom_price: boolean;
  custom_price_entered_by: string | null;
  custom_price_entered_at: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Orders table.
 * Used for branch stock requisitions, advance orders, and custom cake orders.
 */
export interface Order {
  id: string;
  branch_id: string;
  order_number: string;
  order_type?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  product_variant_id?: string | null;
  quantity?: number;
  is_custom_cake?: boolean;
  is_urgent?: boolean;
  design_notes?: string | null;
  quoted_price?: number | null;
  quoted_price_entered_by?: string | null;
  quoted_price_entered_at?: string | null;
  deposit_paid?: number;
  delivery_date?: string | null;
  required_date?: string | null;
  status: OrderStatus;
  notes?: string | null;
  rejection_reason?: string | null;
  transfer_id?: string | null;
  photo_url?: string | null;
  created_by?: string | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_variant_id: string;
  quantity: number;
  notes?: string | null;
  created_at: string;
}

// ----------------------------------------------------------------
// VIEW INTERFACES
// ----------------------------------------------------------------

export interface FEFOInventoryRecord {
  inventory_id: string;
  branch_id: string;
  branch_name: string;
  branch_code: string;
  product_variant_id: string;
  variant_name: string;
  quantity_value: number;
  quantity_unit: QuantityUnit;
  product_id: string;
  product_name: string;
  product_category: ProductCategory;
  batch_id: string;
  batch_number: string;
  production_date: string;
  expiry_date: string;
  quantity_available: number;
  quantity_in_transit: number;
  is_expired: boolean;
  days_until_expiry: number;
}

export interface DailySalesSummary {
  branch_id: string;
  branch_name: string;
  branch_code: string;
  sale_date: string;
  total_transactions: number;
  total_revenue: number;
  total_cash: number;
  total_online: number;
  total_items_sold: number;
}

import { supabase } from '@/lib/supabase';
import type {
  Product,
  ProductVariant,
  PricingRule,
  ProductCategory,
  QuantityUnit,
  PricingType,
} from '@/types/database';

export interface ProductWithVariants extends Product {
  variants: (ProductVariant & {
    pricing_rules?: PricingRule[];
  })[];
}

export const productService = {
  async getAllProducts(): Promise<ProductWithVariants[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants (
          *,
          pricing_rules (*)
        )
      `)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      throw error;
    }

    return (data as ProductWithVariants[]) || [];
  },

  async getActiveProducts(): Promise<ProductWithVariants[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants (
          *,
          pricing_rules (*)
        )
      `)
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching active products:', error);
      throw error;
    }

    return (data as ProductWithVariants[]) || [];
  },

  async createProduct(params: {
    name: string;
    category: ProductCategory;
    description?: string;
    show_weight_size?: boolean;
    has_price?: boolean;
    price?: number | null;
    variant_name?: string;
    quantity_value?: number;
    quantity_unit?: QuantityUnit;
    pricing_type?: PricingType;
  }): Promise<Product> {
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: params.name,
        category: params.category,
        description: params.description || null,
        show_weight_size: params.show_weight_size ?? true,
        active: true,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating product:', error);
      throw error;
    }

    // If a price or variant was supplied, automatically create the default variant & pricing rule
    const varName = params.variant_name || (params.show_weight_size === false ? 'Standard' : '1 Piece');
    const hasPrice = params.has_price ?? (params.price !== undefined && params.price !== null);
    const basePrice = hasPrice && params.price !== undefined && params.price !== null ? Number(params.price) : null;
    const pricingType = params.pricing_type || 'FIXED_PER_UNIT';
    const qtyVal = params.quantity_value || 1;
    const qtyUnit = params.quantity_unit || 'PIECE';

    await this.createVariant({
      product_id: product.id,
      name: varName,
      quantity_value: qtyVal,
      quantity_unit: qtyUnit,
      pricing_type: pricingType,
      base_price: basePrice,
    });

    return product;
  },

  async updateProduct(
    id: string,
    params: {
      name?: string;
      category?: ProductCategory;
      description?: string;
      show_weight_size?: boolean;
      active?: boolean;
      variant_id?: string;
      variant_name?: string;
      has_price?: boolean;
      base_price?: number | null;
    }
  ): Promise<Product> {
    const updateData: Record<string, unknown> = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.category !== undefined) updateData.category = params.category;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.show_weight_size !== undefined) updateData.show_weight_size = params.show_weight_size;
    if (params.active !== undefined) updateData.active = params.active;

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating product:', error);
      throw error;
    }

    if (params.variant_id) {
      if (params.variant_name !== undefined) {
        await supabase
          .from('product_variants')
          .update({ name: params.variant_name })
          .eq('id', params.variant_id);
      }
      if (params.has_price !== undefined || params.base_price !== undefined) {
        const hasPrice = params.has_price ?? (params.base_price !== undefined && params.base_price !== null);
        const priceToSet = hasPrice && params.base_price !== undefined && params.base_price !== null ? Number(params.base_price) : null;
        await this.setVariantPricing({
          variant_id: params.variant_id,
          pricing_type: 'FIXED_PER_UNIT',
          base_price: priceToSet,
        });
      }
    }

    return data;
  },

  async toggleProductActive(id: string, active: boolean): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ active })
      .eq('id', id);

    if (error) {
      console.error('Error toggling product active status:', error);
      throw error;
    }
  },

  async createVariant(params: {
    product_id: string;
    name: string;
    quantity_value: number;
    quantity_unit: QuantityUnit;
    pricing_type: PricingType;
    base_price: number | null;
  }): Promise<ProductVariant> {
    // 1. Insert variant
    const { data: variant, error: vErr } = await supabase
      .from('product_variants')
      .insert({
        product_id: params.product_id,
        name: params.name,
        quantity_value: params.quantity_value,
        quantity_unit: params.quantity_unit,
        active: true,
      })
      .select('*')
      .single();

    if (vErr) {
      console.error('Error creating variant:', vErr);
      throw vErr;
    }

    // 2. Insert pricing rule
    const { error: prErr } = await supabase.from('pricing_rules').insert({
      product_variant_id: variant.id,
      pricing_type: params.pricing_type,
      base_price: params.pricing_type === 'CUSTOM' ? null : params.base_price,
      active: true,
    });

    if (prErr) {
      console.error('Error setting pricing rule:', prErr);
      throw prErr;
    }

    return variant;
  },

  async setVariantPricing(params: {
    variant_id: string;
    pricing_type: PricingType;
    base_price: number | null;
  }): Promise<void> {
    // Deactivate previous pricing rules for this variant
    await supabase
      .from('pricing_rules')
      .update({ active: false })
      .eq('product_variant_id', params.variant_id);

    // Insert new active pricing rule
    const { error } = await supabase.from('pricing_rules').insert({
      product_variant_id: params.variant_id,
      pricing_type: params.pricing_type,
      base_price: params.pricing_type === 'CUSTOM' ? null : params.base_price,
      active: true,
    });

    if (error) {
      console.error('Error updating pricing rule:', error);
      throw error;
    }
  },

  /**
   * STANDARD MENU PRICING:
   * Retrieves the active standard menu price snapshot from database pricing rules for a variant.
   */
  async getStandardMenuPrice(variantId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('base_price')
      .eq('product_variant_id', variantId)
      .eq('active', true)
      .neq('pricing_type', 'CUSTOM')
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching standard menu price:', error);
      throw error;
    }

    return data?.base_price ?? null;
  },
};

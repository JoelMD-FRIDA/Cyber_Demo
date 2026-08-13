import { getProviderAdapter } from './domain-check-cysmo';
import type { Database } from '@/lib/supabase/types';
import { ApiError } from '@/lib/api-errors';

type Provider = Database['public']['Tables']['domain_check_providers']['Row'];
type Category = Database['public']['Tables']['domain_check_categories']['Row'];

export function mapProvider(provider: Provider) {
  return {
    id: provider.id,
    providerKey: provider.provider_key,
    name: provider.name,
    isActive: provider.is_active,
    isConfigured: getProviderAdapter(provider.provider_key)?.isConfigured ?? false,
    websiteUrl: provider.website_url,
    description: provider.description,
    shortDescription: provider.short_description,
    longDescription: provider.long_description,
    assetPath: provider.asset_path,
    createdAt: provider.created_at,
    updatedAt: provider.updated_at,
  };
}

export function mapCategory(category: Category) {
  return {
    id: category.id,
    categoryKey: category.category_key,
    name: category.name,
    description: category.description,
    assetPath: category.asset_path,
    createdAt: category.created_at,
    updatedAt: category.updated_at,
  };
}

export function validateOptionalUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new ApiError('INVALID_INPUT', 'A valid HTTP or HTTPS URL is required.');
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new ApiError('INVALID_INPUT', 'A valid HTTP or HTTPS URL is required.');
    return value;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('INVALID_INPUT', 'A valid HTTP or HTTPS URL is required.');
  }
}

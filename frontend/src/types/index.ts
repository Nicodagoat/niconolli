// Organization
export interface Organization {
  id: string;
  name: string;
  industry: string;
  country: string;
  description?: string;
  employee_count?: number;
  annual_revenue?: number;
  revenue_currency: string;
  created_at: string;
  updated_at: string;
}

export interface Facility {
  id: string;
  organization_id: string;
  name: string;
  address?: string;
  city?: string;
  state_province?: string;
  country: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  facility_type?: string;
  egrid_subregion?: string;
}

// Inventory
export type InventoryStatus = 'draft' | 'in_progress' | 'review' | 'approved' | 'published';
export type BoundaryApproach = 'operational_control' | 'financial_control' | 'equity_share';
export type GWPVersion = 'ar5' | 'ar6';

export interface Inventory {
  id: string;
  organization_id: string;
  name: string;
  reporting_year: number;
  start_date: string;
  end_date: string;
  boundary_approach: BoundaryApproach;
  gwp_version: GWPVersion;
  status: InventoryStatus;
  notes?: string;
  base_year?: number;
  created_at: string;
  updated_at: string;
}

// Activity
export type Scope = 'scope_1' | 'scope_2' | 'scope_3';
export type DataQuality = 'high' | 'medium' | 'low' | 'default';

export interface Activity {
  id: string;
  inventory_id: string;
  facility_id?: string;
  scope: Scope;
  category: string;
  subcategory?: string;
  description?: string;
  activity_value: number;
  activity_unit: string;
  fuel_type?: string;
  source_detail?: string;
  scope2_method?: string;
  activity_date: string;
  data_quality: DataQuality;
  data_source?: string;
  uncertainty_pct?: number;
  emission_factor_id?: string;
  is_biogenic: boolean;
  created_at: string;
}

export interface ActivityCreate {
  scope: Scope;
  category: string;
  subcategory?: string;
  description?: string;
  activity_value: number;
  activity_unit: string;
  fuel_type?: string;
  source_detail?: string;
  scope2_method?: string;
  activity_date: string;
  period_start?: string;
  period_end?: string;
  data_quality: DataQuality;
  data_source?: string;
  uncertainty_pct?: number;
  emission_factor_id?: string;
  is_biogenic: boolean;
  facility_id?: string;
}

// Emission Factor
export interface EmissionFactor {
  id: string;
  source: string;
  category: string;
  name: string;
  description?: string;
  co2_factor: number;
  ch4_factor: number;
  n2o_factor: number;
  co2e_factor: number;
  input_unit: string;
  output_unit: string;
  region?: string;
  year: number;
  gwp_version: string;
  fuel_type?: string;
  vehicle_type?: string;
  is_active: boolean;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

// Calculation
export interface CalculationResult {
  id: string;
  inventory_id: string;
  activity_id: string;
  scope: string;
  category: string;
  subcategory?: string;
  co2_kg: number;
  ch4_kg: number;
  n2o_kg: number;
  total_co2e_kg: number;
  total_co2e_tonnes: number;
  biogenic_co2_kg: number;
  uncertainty_pct?: number;
  data_quality?: string;
  emission_factor_used?: string;
  emission_factor_value?: number;
  gwp_version?: string;
  calculated_at: string;
}

export interface InventorySummary {
  inventory_id: string;
  reporting_year: number;
  total_co2e_tonnes: number;
  scope_1_tonnes: number;
  scope_2_tonnes: number;
  scope_3_tonnes: number;
  scope_1_categories: Record<string, number>;
  scope_2_categories: Record<string, number>;
  scope_3_categories: Record<string, number>;
  intensity_per_employee?: number;
  intensity_per_revenue?: number;
  data_quality_breakdown: Record<string, number>;
  activity_count: number;
}

export interface EmissionsTrend {
  period: string;
  scope_1: number;
  scope_2: number;
  scope_3: number;
  total: number;
}

export interface ScopeBreakdown {
  scope: string;
  category: string;
  total_co2e_tonnes: number;
  percentage: number;
  activity_count: number;
}

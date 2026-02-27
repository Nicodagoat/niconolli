import { useForm } from 'react-hook-form';
import type { ActivityCreate, Scope } from '../../types';

interface ActivityFormProps {
  onSubmit: (data: ActivityCreate) => void;
  onCancel: () => void;
  defaultScope?: Scope;
}

const SCOPE_CATEGORIES: Record<Scope, { value: string; label: string }[]> = {
  scope_1: [
    { value: 'stationary_combustion', label: 'Stationary Combustion' },
    { value: 'mobile_combustion', label: 'Mobile Combustion' },
    { value: 'fugitive_emissions', label: 'Fugitive Emissions' },
    { value: 'process_emissions', label: 'Process Emissions' },
  ],
  scope_2: [
    { value: 'electricity', label: 'Electricity' },
    { value: 'heat_steam', label: 'Heat / Steam / Cooling' },
  ],
  scope_3: [
    { value: 'cat_1_purchased_goods_services', label: 'Cat 1: Purchased Goods & Services' },
    { value: 'cat_2_capital_goods', label: 'Cat 2: Capital Goods' },
    { value: 'cat_3_fuel_energy_related', label: 'Cat 3: Fuel & Energy Related' },
    { value: 'cat_4_upstream_transportation', label: 'Cat 4: Upstream Transportation' },
    { value: 'cat_5_waste_operations', label: 'Cat 5: Waste in Operations' },
    { value: 'cat_6_business_travel', label: 'Cat 6: Business Travel' },
    { value: 'cat_7_employee_commuting', label: 'Cat 7: Employee Commuting' },
    { value: 'cat_8_upstream_leased_assets', label: 'Cat 8: Upstream Leased Assets' },
    { value: 'cat_9_downstream_transportation', label: 'Cat 9: Downstream Transportation' },
    { value: 'cat_11_use_sold_products', label: 'Cat 11: Use of Sold Products' },
    { value: 'cat_12_end_of_life', label: 'Cat 12: End-of-Life Treatment' },
  ],
};

const ACTIVITY_UNITS = [
  { group: 'Volume', units: ['liters', 'gallons_us', 'cubic_meters', 'therms', 'mmbtu'] },
  { group: 'Energy', units: ['kwh', 'mwh', 'gj'] },
  { group: 'Distance', units: ['km', 'miles'] },
  { group: 'Mass', units: ['kg', 'tonnes', 'lbs', 'short_tons'] },
  { group: 'Currency', units: ['usd', 'eur', 'gbp'] },
  { group: 'Transport', units: ['passenger_km', 'tonne_km'] },
  { group: 'Other', units: ['nights'] },
];

export default function ActivityForm({ onSubmit, onCancel, defaultScope = 'scope_1' }: ActivityFormProps) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ActivityCreate>({
    defaultValues: {
      scope: defaultScope,
      data_quality: 'medium',
      is_biogenic: false,
      activity_date: new Date().toISOString().split('T')[0],
    },
  });

  const selectedScope = watch('scope') as Scope;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scope */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scope *</label>
          <select {...register('scope', { required: true })} className="w-full rounded-lg border-gray-300 border p-2.5 text-sm">
            <option value="scope_1">Scope 1 - Direct Emissions</option>
            <option value="scope_2">Scope 2 - Indirect Energy</option>
            <option value="scope_3">Scope 3 - Value Chain</option>
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select {...register('category', { required: true })} className="w-full rounded-lg border-gray-300 border p-2.5 text-sm">
            <option value="">Select category...</option>
            {SCOPE_CATEGORIES[selectedScope]?.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          {errors.category && <p className="text-red-500 text-xs mt-1">Category is required</p>}
        </div>

        {/* Activity Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Activity Value *</label>
          <input
            type="number"
            step="any"
            {...register('activity_value', { required: true, min: 0.001, valueAsNumber: true })}
            className="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
            placeholder="e.g., 10000"
          />
          {errors.activity_value && <p className="text-red-500 text-xs mt-1">Valid positive value required</p>}
        </div>

        {/* Activity Unit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
          <select {...register('activity_unit', { required: true })} className="w-full rounded-lg border-gray-300 border p-2.5 text-sm">
            <option value="">Select unit...</option>
            {ACTIVITY_UNITS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.units.map((u) => (
                  <option key={u} value={u}>{u.replace(/_/g, ' ')}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Fuel Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fuel / Source Type</label>
          <input
            type="text"
            {...register('fuel_type')}
            className="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
            placeholder="e.g., natural_gas, diesel, gasoline"
          />
        </div>

        {/* Activity Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Activity Date *</label>
          <input
            type="date"
            {...register('activity_date', { required: true })}
            className="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
          />
        </div>

        {/* Data Quality */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Quality</label>
          <select {...register('data_quality')} className="w-full rounded-lg border-gray-300 border p-2.5 text-sm">
            <option value="high">High - Measured/Metered</option>
            <option value="medium">Medium - Calculated from proxies</option>
            <option value="low">Low - Estimated/Spend-based</option>
            <option value="default">Default - Industry average</option>
          </select>
        </div>

        {/* Data Source */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
          <input
            type="text"
            {...register('data_source')}
            className="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
            placeholder="e.g., Utility bill, Smart meter"
          />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            {...register('description')}
            rows={2}
            className="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
            placeholder="Optional description of this activity..."
          />
        </div>

        {/* Scope 2 Method */}
        {selectedScope === 'scope_2' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope 2 Method</label>
            <select {...register('scope2_method')} className="w-full rounded-lg border-gray-300 border p-2.5 text-sm">
              <option value="location_based">Location-Based</option>
              <option value="market_based">Market-Based</option>
            </select>
          </div>
        )}

        {/* Biogenic */}
        <div className="flex items-center space-x-2 pt-6">
          <input type="checkbox" {...register('is_biogenic')} className="rounded border-gray-300" />
          <label className="text-sm text-gray-700">Biogenic CO2 (from biomass)</label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
          Add Activity
        </button>
      </div>
    </form>
  );
}

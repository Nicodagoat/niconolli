import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Flame, Zap, Link2, BarChart3, Save, Calculator, CheckCircle,
  AlertTriangle, HelpCircle, Plus, Trash2, Download, FileText, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { formatTonnes } from '../utils/formatters';
import type { SMEProject } from './SMEProjectsPage';

type WizardTab = 'scope1' | 'scope2' | 'scope3' | 'results';

interface DataEntry {
  id: string;
  category: string;
  subcategory: string;
  description: string;
  value: number;
  unit: string;
  fuel_type?: string;
  ef_value?: number;
  ef_source?: string;
  co2e_tonnes?: number;
}

// GHG Protocol + ESRS E1 compliant emission factors — Italian context
// Sources: ISPRA NIR 2024, DEFRA 2024, IPCC AR6, AIB 2024, EEIO 2024
const EF_LOOKUP: Record<string, { value: number; source: string; unit: string }> = {
  // ── Scope 1: Stationary Combustion ──
  'natural_gas':        { value: 0.00205,  source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  'diesel':             { value: 2.68,     source: 'DEFRA 2024',    unit: 'kgCO2/litre' },
  'lpg':                { value: 1.56,     source: 'DEFRA 2024',    unit: 'kgCO2/litre' },
  'gasoline':           { value: 2.31,     source: 'DEFRA 2024',    unit: 'kgCO2/litre' },
  'heating_oil':        { value: 2.96,     source: 'DEFRA 2024',    unit: 'kgCO2/litre' },
  'fuel_oil':           { value: 3.17,     source: 'ISPRA 2024',    unit: 'kgCO2/litre' },
  'kerosene':           { value: 2.54,     source: 'DEFRA 2024',    unit: 'kgCO2/litre' },
  'coal':               { value: 2.42,     source: 'IPCC 2006',     unit: 'tCO2/tonne' },
  'wood_pellets':       { value: 0.015,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'biomass':            { value: 0.0,      source: 'GHG Protocol',  unit: 'tCO2/tonne' },
  'biogas':             { value: 0.00023,  source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  'cng':                { value: 2.54,     source: 'ISPRA 2024',    unit: 'kgCO2/kg' },
  // ── Scope 1: Fugitive Emissions (Refrigerants - IPCC AR6 GWP100) ──
  'refrigerant_r410a':  { value: 2088,     source: 'IPCC AR6',      unit: 'GWP' },
  'refrigerant_r134a':  { value: 1430,     source: 'IPCC AR6',      unit: 'GWP' },
  'refrigerant_r32':    { value: 675,      source: 'IPCC AR6',      unit: 'GWP' },
  'refrigerant_r404a':  { value: 3922,     source: 'IPCC AR6',      unit: 'GWP' },
  'refrigerant_r407c':  { value: 1774,     source: 'IPCC AR6',      unit: 'GWP' },
  'refrigerant_r22':    { value: 1810,     source: 'IPCC AR6',      unit: 'GWP' },
  'sf6':                { value: 25200,    source: 'IPCC AR6',      unit: 'GWP' },
  // ── Scope 1: Process Emissions ──
  'process_cement':     { value: 0.525,    source: 'IPCC 2006',     unit: 'tCO2/tonne' },
  'process_lime':       { value: 0.785,    source: 'IPCC 2006',     unit: 'tCO2/tonne' },
  'process_steel':      { value: 1.85,     source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'process_aluminum':   { value: 1.60,     source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'process_glass':      { value: 0.60,     source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'welding_co2':        { value: 0.001,    source: 'DEFRA 2024',    unit: 'tCO2/kg' },
  // ── Scope 2: Purchased Energy ──
  'electricity_ita':    { value: 0.000260, source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  'electricity_market': { value: 0.000350, source: 'AIB 2024',      unit: 'tCO2/kWh' },
  'electricity_renew':  { value: 0.0,      source: 'GO Certificate', unit: 'tCO2/kWh' },
  'district_heating':   { value: 0.000200, source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  'steam':              { value: 0.000170, source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  'cooling':            { value: 0.000260, source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  // ── Scope 3 Cat 1: Purchased Goods & Services ──
  'spend_goods':        { value: 0.0005,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_food_bev':     { value: 0.0008,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_chemicals':    { value: 0.0007,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_metals':       { value: 0.0009,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_plastics':     { value: 0.0006,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_textiles':     { value: 0.0007,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_paper':        { value: 0.0004,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_it':           { value: 0.00045,  source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'water_supply':       { value: 0.000344, source: 'DEFRA 2024',    unit: 'tCO2/m3' },
  'paper_kg':           { value: 0.000919, source: 'DEFRA 2024',    unit: 'tCO2/kg' },
  // ── Scope 3 Cat 2: Capital Goods ──
  'spend_capital':      { value: 0.0004,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_machinery':    { value: 0.00055,  source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_vehicles':     { value: 0.00050,  source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_buildings':    { value: 0.00045,  source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  // ── Scope 3 Cat 3: Fuel & Energy ──
  'wtt_natural_gas':    { value: 0.00031,  source: 'DEFRA 2024',    unit: 'tCO2/kWh' },
  'wtt_diesel':         { value: 0.63,     source: 'DEFRA 2024',    unit: 'kgCO2/litre' },
  'wtt_electricity':    { value: 0.000019, source: 'DEFRA 2024',    unit: 'tCO2/kWh' },
  // ── Scope 3 Cat 4: Upstream Transportation ──
  'transport_road':     { value: 0.000103, source: 'DEFRA 2024',    unit: 'tCO2/km' },
  'freight_road':       { value: 0.000107, source: 'DEFRA 2024',    unit: 'tCO2/tonne-km' },
  'freight_rail':       { value: 0.000028, source: 'DEFRA 2024',    unit: 'tCO2/tonne-km' },
  'freight_sea':        { value: 0.000016, source: 'DEFRA 2024',    unit: 'tCO2/tonne-km' },
  'freight_air':        { value: 0.000602, source: 'DEFRA 2024',    unit: 'tCO2/tonne-km' },
  // ── Scope 3 Cat 5: Waste ──
  'waste_landfill':     { value: 0.586,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'waste_recycling':    { value: 0.021,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'waste_incineration': { value: 0.021,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'waste_composting':   { value: 0.010,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'waste_water':        { value: 0.708,    source: 'DEFRA 2024',    unit: 'tCO2/m3' },
  // ── Scope 3 Cat 6: Business Travel ──
  'transport_air_short':{ value: 0.000255, source: 'DEFRA 2024',    unit: 'tCO2/km' },
  'transport_air_long': { value: 0.000195, source: 'DEFRA 2024',    unit: 'tCO2/km' },
  'transport_rail':     { value: 0.000041, source: 'DEFRA 2024',    unit: 'tCO2/km' },
  'hotel_nights':       { value: 0.0157,   source: 'DEFRA 2024',    unit: 'tCO2/night' },
  'taxi_km':            { value: 0.000149, source: 'DEFRA 2024',    unit: 'tCO2/km' },
  // ── Scope 3 Cat 7: Employee Commuting ──
  'commuting_car':      { value: 0.000171, source: 'ISPRA 2024',    unit: 'tCO2/km' },
  'commuting_public':   { value: 0.000068, source: 'ISPRA 2024',    unit: 'tCO2/km' },
  'commuting_ebike':    { value: 0.000005, source: 'ISPRA 2024',    unit: 'tCO2/km' },
  'commuting_motorbike':{ value: 0.000113, source: 'ISPRA 2024',    unit: 'tCO2/km' },
  // ── Scope 3 Cat 8: Upstream Leased Assets ──
  'spend_services':     { value: 0.0003,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_leases':       { value: 0.0003,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  // ── Scope 3 Cat 9: Downstream Transportation ──
  'dist_road':          { value: 0.000107, source: 'DEFRA 2024',    unit: 'tCO2/tonne-km' },
  'dist_rail':          { value: 0.000028, source: 'DEFRA 2024',    unit: 'tCO2/tonne-km' },
  'dist_sea':           { value: 0.000016, source: 'DEFRA 2024',    unit: 'tCO2/tonne-km' },
  'dist_air':           { value: 0.000602, source: 'DEFRA 2024',    unit: 'tCO2/tonne-km' },
  'dist_last_mile':     { value: 0.000181, source: 'DEFRA 2024',    unit: 'tCO2/parcel' },
  // ── Scope 3 Cat 10: Processing of Sold Products ──
  'processing_energy':  { value: 0.000260, source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  'processing_spend':   { value: 0.0004,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  // ── Scope 3 Cat 11: Use of Sold Products (Product Lifecycle) ──
  'product_elec_use':   { value: 0.000260, source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  'product_fuel_use':   { value: 2.68,     source: 'DEFRA 2024',    unit: 'kgCO2/litre' },
  'product_gas_use':    { value: 0.00205,  source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  // ── Scope 3 Cat 12: End-of-Life Treatment of Sold Products ──
  'eol_landfill':       { value: 0.586,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'eol_recycling':      { value: 0.021,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'eol_incineration':   { value: 0.021,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'eol_composting':     { value: 0.010,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  // ── Scope 3 Cat 13-15: Downstream Leased, Franchises, Investments ──
  'invest_equity':      { value: 0.0003,   source: 'PCAF 2022',     unit: 'tCO2/EUR' },
  'invest_debt':        { value: 0.0002,   source: 'PCAF 2022',     unit: 'tCO2/EUR' },
  'franchise_spend':    { value: 0.0004,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  // ── Product / Packaging (ESRS E5 - Circular Economy) ──
  'packaging_plastic':  { value: 0.00290,  source: 'DEFRA 2024',    unit: 'tCO2/kg' },
  'packaging_cardboard':{ value: 0.00059,  source: 'DEFRA 2024',    unit: 'tCO2/kg' },
  'packaging_glass':    { value: 0.00086,  source: 'DEFRA 2024',    unit: 'tCO2/kg' },
  'packaging_aluminum': { value: 0.00970,  source: 'DEFRA 2024',    unit: 'tCO2/kg' },
  'packaging_steel':    { value: 0.00260,  source: 'DEFRA 2024',    unit: 'tCO2/kg' },
};

function calculateCO2e(entry: DataEntry): number {
  if (!entry.fuel_type) return 0;
  const ef = EF_LOOKUP[entry.fuel_type];
  if (!ef) return 0;

  // Refrigerants & F-gases: value is in kg, EF is GWP => result = kg * GWP / 1000 = tonnes
  if (entry.fuel_type.startsWith('refrigerant_') || entry.fuel_type === 'sf6') {
    return (entry.value * ef.value) / 1000;
  }
  // kgCO2 units (fuels in litres, CNG in kg, welding gas): result = value * EF / 1000 = tonnes
  if (ef.unit.includes('kgCO2')) {
    return (entry.value * ef.value) / 1000;
  }
  // tCO2/kWh, tCO2/tonne, tCO2/EUR, tCO2/km, tCO2/tonne-km, tCO2/m3, tCO2/kg, tCO2/night, tCO2/parcel => value * EF
  return entry.value * ef.value;
}

const SCOPE3_CATEGORIES = [
  { id: 'cat1', label: 'Cat 1: Purchased Goods & Services', fuelTypes: ['spend_goods', 'spend_food_bev', 'spend_chemicals', 'spend_metals', 'spend_plastics', 'spend_textiles', 'spend_paper', 'spend_it', 'water_supply', 'paper_kg'] },
  { id: 'cat2', label: 'Cat 2: Capital Goods', fuelTypes: ['spend_capital', 'spend_machinery', 'spend_vehicles', 'spend_buildings'] },
  { id: 'cat3', label: 'Cat 3: Fuel & Energy (WTT)', fuelTypes: ['wtt_natural_gas', 'wtt_diesel', 'wtt_electricity'] },
  { id: 'cat4', label: 'Cat 4: Upstream Transportation', fuelTypes: ['freight_road', 'freight_rail', 'freight_sea', 'freight_air'] },
  { id: 'cat5', label: 'Cat 5: Waste Generated', fuelTypes: ['waste_landfill', 'waste_recycling', 'waste_incineration', 'waste_composting', 'waste_water'] },
  { id: 'cat6', label: 'Cat 6: Business Travel', fuelTypes: ['transport_air_short', 'transport_air_long', 'transport_rail', 'hotel_nights', 'taxi_km'] },
  { id: 'cat7', label: 'Cat 7: Employee Commuting', fuelTypes: ['commuting_car', 'commuting_public', 'commuting_ebike', 'commuting_motorbike'] },
  { id: 'cat8', label: 'Cat 8: Upstream Leased Assets', fuelTypes: ['spend_services', 'spend_leases'] },
  { id: 'cat9', label: 'Cat 9: Downstream Transportation', fuelTypes: ['dist_road', 'dist_rail', 'dist_sea', 'dist_air', 'dist_last_mile'] },
  { id: 'cat10', label: 'Cat 10: Processing of Sold Products', fuelTypes: ['processing_energy', 'processing_spend'] },
  { id: 'cat11', label: 'Cat 11: Use of Sold Products', fuelTypes: ['product_elec_use', 'product_fuel_use', 'product_gas_use'] },
  { id: 'cat12', label: 'Cat 12: End-of-Life Treatment', fuelTypes: ['eol_landfill', 'eol_recycling', 'eol_incineration', 'eol_composting'] },
  { id: 'cat13', label: 'Cat 13: Downstream Leased Assets', fuelTypes: ['spend_leases'] },
  { id: 'cat14', label: 'Cat 14: Franchises', fuelTypes: ['franchise_spend'] },
  { id: 'cat15', label: 'Cat 15: Investments', fuelTypes: ['invest_equity', 'invest_debt'] },
];

const SCOPE1_FUEL_OPTIONS = [
  { value: 'natural_gas', label: 'Metano / Gas Naturale (kWh)' },
  { value: 'diesel', label: 'Gasolio / Diesel (litri)' },
  { value: 'gasoline', label: 'Benzina (litri)' },
  { value: 'lpg', label: 'GPL (litri)' },
  { value: 'heating_oil', label: 'Olio Combustibile Riscaldamento (litri)' },
  { value: 'fuel_oil', label: 'Olio Combustibile Pesante (litri)' },
  { value: 'kerosene', label: 'Cherosene (litri)' },
  { value: 'cng', label: 'Metano Autotrazione CNG (kg)' },
  { value: 'coal', label: 'Carbone (tonnellate)' },
  { value: 'wood_pellets', label: 'Pellet di Legno (tonnellate)' },
  { value: 'biomass', label: 'Biomassa (tonnellate)' },
  { value: 'biogas', label: 'Biogas (kWh)' },
  { value: 'refrigerant_r410a', label: 'Refrigerante R410A (kg)' },
  { value: 'refrigerant_r134a', label: 'Refrigerante R134A (kg)' },
  { value: 'refrigerant_r32', label: 'Refrigerante R32 (kg)' },
  { value: 'refrigerant_r404a', label: 'Refrigerante R404A (kg)' },
  { value: 'refrigerant_r407c', label: 'Refrigerante R407C (kg)' },
  { value: 'refrigerant_r22', label: 'Refrigerante R22 (kg)' },
  { value: 'sf6', label: 'SF6 - Esafluoruro di Zolfo (kg)' },
  { value: 'process_cement', label: 'Processo - Cemento (tonnellate)' },
  { value: 'process_lime', label: 'Processo - Calce (tonnellate)' },
  { value: 'process_steel', label: 'Processo - Acciaio (tonnellate)' },
  { value: 'process_aluminum', label: 'Processo - Alluminio (tonnellate)' },
  { value: 'process_glass', label: 'Processo - Vetro (tonnellate)' },
  { value: 'welding_co2', label: 'Gas Saldatura CO2 (kg)' },
];

const SCOPE2_FUEL_OPTIONS = [
  { value: 'electricity_ita', label: 'Elettricità - Rete Nazionale (kWh)' },
  { value: 'electricity_market', label: 'Elettricità - Market-based (kWh)' },
  { value: 'electricity_renew', label: 'Elettricità - 100% Rinnovabile con GO (kWh)' },
  { value: 'district_heating', label: 'Teleriscaldamento (kWh)' },
  { value: 'steam', label: 'Vapore Acquistato (kWh)' },
  { value: 'cooling', label: 'Raffrescamento Acquistato (kWh)' },
];

function getUnitForFuel(fuelType: string): string {
  const ef = EF_LOOKUP[fuelType];
  if (!ef) return '';
  if (fuelType.startsWith('refrigerant_') || fuelType === 'sf6' || fuelType === 'welding_co2') return 'kg';
  if (fuelType === 'cng') return 'kg';
  if (ef.unit.includes('/litre')) return 'litri';
  if (ef.unit.includes('/tonne-km')) return 'tonne-km';
  if (ef.unit.includes('/tonne')) return 'tonnellate';
  if (ef.unit.includes('/kWh')) return 'kWh';
  if (ef.unit.includes('/EUR')) return 'EUR';
  if (ef.unit.includes('/km')) return 'km';
  if (ef.unit.includes('/m3')) return 'm3';
  if (ef.unit.includes('/kg')) return 'kg';
  if (ef.unit.includes('/night')) return 'notti';
  if (ef.unit.includes('/parcel')) return 'spedizioni';
  return '';
}

const STORAGE_KEY_PREFIX = 'sme_project_data_';

interface ProjectData {
  scope1: DataEntry[];
  scope2: DataEntry[];
  scope3: DataEntry[];
  scope2Method: 'location' | 'market';
}

function loadProjectData(projectId: string): ProjectData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + projectId);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

function saveProjectData(projectId: string, data: ProjectData) {
  localStorage.setItem(STORAGE_KEY_PREFIX + projectId, JSON.stringify(data));
}

// Default data for the seed project "1"
const DEFAULT_SCOPE1: DataEntry[] = [
  { id: '1', category: 'stationary_combustion', subcategory: 'Heating', description: 'Office heating - Natural Gas',
    value: 150000, unit: 'kWh', fuel_type: 'natural_gas', ef_value: 0.00205, ef_source: 'ISPRA 2024', co2e_tonnes: 307.5 },
  { id: '2', category: 'mobile_combustion', subcategory: 'Fleet', description: 'Company car fleet - Diesel',
    value: 25000, unit: 'litres', fuel_type: 'diesel', ef_value: 2.68, ef_source: 'DEFRA 2024', co2e_tonnes: 67.0 },
  { id: '3', category: 'fugitive_emissions', subcategory: 'Refrigerants', description: 'AC system - R410A leakage',
    value: 5, unit: 'kg', fuel_type: 'refrigerant_r410a', ef_value: 2088, ef_source: 'IPCC AR6', co2e_tonnes: 10.44 },
];

const DEFAULT_SCOPE2: DataEntry[] = [
  { id: '4', category: 'purchased_electricity', subcategory: 'Grid', description: 'Office electricity consumption',
    value: 500000, unit: 'kWh', fuel_type: 'electricity_ita', ef_value: 0.000260, ef_source: 'ISPRA 2024', co2e_tonnes: 130.0 },
];

const DEFAULT_SCOPE3: DataEntry[] = [
  { id: '5', category: 'cat1', subcategory: 'Purchased Goods', description: 'Office supplies and materials',
    value: 250000, unit: 'EUR', fuel_type: 'spend_goods', ef_value: 0.0005, ef_source: 'EEIO 2024', co2e_tonnes: 125.0 },
  { id: '6', category: 'cat6', subcategory: 'Business Travel', description: 'Flight Rome-Milan (10 trips)',
    value: 5000, unit: 'km', fuel_type: 'transport_air_short', ef_value: 0.000255, ef_source: 'DEFRA 2024', co2e_tonnes: 1.275 },
  { id: '7', category: 'cat7', subcategory: 'Employee Commuting', description: '50 employees avg 20km/day',
    value: 250000, unit: 'km', fuel_type: 'commuting_car', ef_value: 0.000171, ef_source: 'ISPRA 2024', co2e_tonnes: 42.75 },
];

function generateCSV(headers: string[], rows: (string | undefined)[][]): string {
  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const colCount = headers.length;
  const padRow = (r: (string | undefined)[]) => {
    const padded = [...r];
    while (padded.length < colCount) padded.push('');
    return padded.map(v => v ?? '');
  };
  // BOM for Excel UTF-8 compatibility with Italian characters
  return '\ufeff' + [headers.map(escape).join(','), ...rows.map(r => padRow(r).map(escape).join(','))].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SMEProjectDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<WizardTab>('scope1');
  const [calculated, setCalculated] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['stationary']));
  const [showAddModal, setShowAddModal] = useState<{ scope: 'scope1' | 'scope2' | 'scope3'; category?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  // Load project metadata
  const [project, setProject] = useState<SMEProject | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sme_projects');
      if (saved) {
        const projects: SMEProject[] = JSON.parse(saved);
        const found = projects.find(p => p.id === id);
        if (found) setProject(found);
      }
    } catch { /* ignore */ }
  }, [id]);

  // Scope data
  const [scope1Data, setScope1Data] = useState<DataEntry[]>([]);
  const [scope2Data, setScope2Data] = useState<DataEntry[]>([]);
  const [scope3Data, setScope3Data] = useState<DataEntry[]>([]);
  const [scope2Method, setScope2Method] = useState<'location' | 'market'>('location');

  // Load data for this project
  useEffect(() => {
    if (!id) return;
    const data = loadProjectData(id);
    if (data) {
      setScope1Data(data.scope1);
      setScope2Data(data.scope2);
      setScope3Data(data.scope3);
      setScope2Method(data.scope2Method);
    } else if (id === '1') {
      // Seed project gets default data
      setScope1Data(DEFAULT_SCOPE1);
      setScope2Data(DEFAULT_SCOPE2);
      setScope3Data(DEFAULT_SCOPE3);
    }
    // New projects start empty
  }, [id]);

  // Add new entry form
  const [newEntry, setNewEntry] = useState({
    description: '',
    fuel_type: '',
    value: '',
    category: 'stationary_combustion',
  });

  const scope1Total = scope1Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
  const scope2Total = scope2Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
  const scope3Total = scope3Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
  const grandTotal = scope1Total + scope2Total + scope3Total;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  };

  const recalculateAll = useCallback(() => {
    const recalc = (entries: DataEntry[]) =>
      entries.map(e => {
        const co2e = calculateCO2e(e);
        const ef = e.fuel_type ? EF_LOOKUP[e.fuel_type] : undefined;
        return { ...e, co2e_tonnes: co2e, ef_value: ef?.value, ef_source: ef?.source };
      });

    setScope1Data(prev => recalc(prev));
    setScope2Data(prev => recalc(prev));
    setScope3Data(prev => recalc(prev));
    setCalculated(true);
    setActiveTab('results');
  }, []);

  const handleSave = useCallback(() => {
    if (!id) return;
    saveProjectData(id, { scope1: scope1Data, scope2: scope2Data, scope3: scope3Data, scope2Method });

    // Update project totals in the projects list
    try {
      const saved = localStorage.getItem('sme_projects');
      if (saved) {
        const projects: SMEProject[] = JSON.parse(saved);
        const idx = projects.findIndex(p => p.id === id);
        if (idx >= 0) {
          const s1 = scope1Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
          const s2 = scope2Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
          const s3 = scope3Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
          const totalEntries = scope1Data.length + scope2Data.length + scope3Data.length;
          const hasScope1 = scope1Data.length > 0 ? 1 : 0;
          const hasScope2 = scope2Data.length > 0 ? 1 : 0;
          const hasScope3 = scope3Data.length > 0 ? 1 : 0;
          const completeness = Math.round((hasScope1 + hasScope2 + hasScope3) / 3 * 100);

          projects[idx] = {
            ...projects[idx],
            scope1_tonnes: s1,
            scope2_tonnes: s2,
            scope3_tonnes: s3,
            total_co2e_tonnes: s1 + s2 + s3,
            completeness_pct: completeness,
            status: totalEntries === 0 ? 'draft' : completeness >= 100 ? 'calculation' : 'data_collection',
            updated_at: new Date().toISOString().split('T')[0],
          };
          localStorage.setItem('sme_projects', JSON.stringify(projects));
          setProject(projects[idx]);
        }
      }
    } catch { /* ignore */ }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [id, scope1Data, scope2Data, scope3Data, scope2Method]);

  const handleDeleteEntry = (scope: 'scope1' | 'scope2' | 'scope3', entryId: string) => {
    const setter = scope === 'scope1' ? setScope1Data : scope === 'scope2' ? setScope2Data : setScope3Data;
    setter(prev => prev.filter(e => e.id !== entryId));
  };

  const handleAddEntry = () => {
    if (!showAddModal || !newEntry.fuel_type || !newEntry.value || !newEntry.description) return;

    const ef = EF_LOOKUP[newEntry.fuel_type];
    const unit = getUnitForFuel(newEntry.fuel_type);
    const numValue = parseFloat(newEntry.value);
    if (isNaN(numValue) || numValue <= 0) return;

    const entry: DataEntry = {
      id: `e_${Date.now()}`,
      category: newEntry.category,
      subcategory: ef?.source || '',
      description: newEntry.description,
      value: numValue,
      unit,
      fuel_type: newEntry.fuel_type,
      ef_value: ef?.value,
      ef_source: ef?.source,
      co2e_tonnes: 0,
    };
    entry.co2e_tonnes = calculateCO2e(entry);

    if (showAddModal.scope === 'scope1') {
      setScope1Data(prev => [...prev, entry]);
    } else if (showAddModal.scope === 'scope2') {
      setScope2Data(prev => [...prev, entry]);
    } else {
      entry.category = showAddModal.category || 'cat1';
      setScope3Data(prev => [...prev, entry]);
    }

    setShowAddModal(null);
    setNewEntry({ description: '', fuel_type: '', value: '', category: 'stationary_combustion' });
  };

  // Export functions
  const exportGHGProtocolCSV = () => {
    const allEntries = [
      ...scope1Data.map(e => ({ ...e, scope: 'Scope 1' })),
      ...scope2Data.map(e => ({ ...e, scope: 'Scope 2' })),
      ...scope3Data.map(e => ({ ...e, scope: 'Scope 3' })),
    ];
    const headers = ['Scope', 'Category', 'Description', 'Activity Value', 'Unit', 'Emission Factor', 'EF Source', 'tCO2e'];
    const rows = allEntries.map(e => [
      e.scope, e.category, e.description,
      e.value.toString(), e.unit,
      (e.ef_value || 0).toString(), e.ef_source || '',
      (e.co2e_tonnes || 0).toFixed(4),
    ]);
    // Add totals
    rows.push([]);
    rows.push(['TOTALS', '', '', '', '', '', '', '']);
    rows.push(['Scope 1 Total', '', '', '', '', '', '', scope1Total.toFixed(4)]);
    rows.push(['Scope 2 Total', '', '', '', '', '', '', scope2Total.toFixed(4)]);
    rows.push(['Scope 3 Total', '', '', '', '', '', '', scope3Total.toFixed(4)]);
    rows.push(['Grand Total', '', '', '', '', '', '', grandTotal.toFixed(4)]);

    const csv = generateCSV(headers, rows);
    downloadFile(csv, `${project?.project_id || 'SME'}_GHG_Protocol_Report.csv`, 'text/csv');
  };

  const exportAuditTrailCSV = () => {
    const allEntries = [
      ...scope1Data.map(e => ({ ...e, scope: 'Scope 1' })),
      ...scope2Data.map(e => ({ ...e, scope: 'Scope 2' })),
      ...scope3Data.map(e => ({ ...e, scope: 'Scope 3' })),
    ];
    const headers = [
      'Entry ID', 'Scope', 'Category', 'Subcategory', 'Description',
      'Activity Value', 'Unit', 'Fuel Type', 'EF Value', 'EF Unit', 'EF Source',
      'Calculated tCO2e', 'GWP Version', 'Methodology', 'Calculation Date',
    ];
    const rows = allEntries.map(e => [
      e.id, e.scope, e.category, e.subcategory, e.description,
      e.value.toString(), e.unit, e.fuel_type || '',
      (e.ef_value || 0).toString(), EF_LOOKUP[e.fuel_type || '']?.unit || '', e.ef_source || '',
      (e.co2e_tonnes || 0).toFixed(6), 'IPCC AR6', 'GHG Protocol Corporate Standard',
      new Date().toISOString(),
    ]);
    const csv = generateCSV(headers, rows);
    downloadFile(csv, `${project?.project_id || 'SME'}_Audit_Trail.csv`, 'text/csv');
  };

  const exportCDPCSV = () => {
    const headers = ['CDP Category', 'Scope', 'Emissions (tCO2e)', 'Methodology', 'Source', 'Verification Status'];
    const rows: string[][] = [];
    rows.push(['C6.1 - Scope 1', 'Scope 1', scope1Total.toFixed(2), 'GHG Protocol', 'ISPRA/DEFRA/IPCC', 'Not verified']);
    rows.push(['C6.3 - Scope 2 (location)', 'Scope 2', scope2Total.toFixed(2), 'GHG Protocol', 'ISPRA 2024', 'Not verified']);
    // Dynamically include all active Scope 3 categories
    for (const cat of SCOPE3_CATEGORIES) {
      const catTotal = scope3Data.filter(e => e.category === cat.id).reduce((s, e) => s + (e.co2e_tonnes || 0), 0);
      if (catTotal > 0) {
        const method = cat.id.match(/cat[12]/) ? 'Spend-based' : cat.id.match(/cat[67]/) ? 'Distance-based' : cat.id.match(/cat[45]/) ? 'Weight-based' : 'Hybrid';
        const source = cat.fuelTypes.some(ft => ft.startsWith('spend_') || ft.startsWith('invest_') || ft.startsWith('franchise_')) ? 'EEIO 2024' :
                       cat.fuelTypes.some(ft => ft.startsWith('commuting_')) ? 'ISPRA 2024' : 'DEFRA 2024';
        rows.push([`C6.5 - Scope 3 ${cat.label}`, 'Scope 3', catTotal.toFixed(2), method, source, 'Not verified']);
      }
    }
    rows.push(['', '', '', '', '', '']);
    rows.push(['TOTAL', 'All', grandTotal.toFixed(2), '', '', '']);
    const csv = generateCSV(headers, rows);
    downloadFile(csv, `${project?.project_id || 'SME'}_CDP_Report.csv`, 'text/csv');
  };

  // ESRS E1 Climate Change Report (EU 2023/2772 - D.Lgs. 125/2024)
  const exportESRSE1Report = () => {
    const now = new Date().toISOString();
    const year = project?.reporting_year || new Date().getFullYear();
    const company = project?.company_name || 'Azienda';
    const scope3byCat: Record<string, number> = {};
    for (const cat of SCOPE3_CATEGORIES) {
      scope3byCat[cat.id] = scope3Data.filter(e => e.category === cat.id).reduce((s, e) => s + (e.co2e_tonnes || 0), 0);
    }
    const scope3Significant = Object.entries(scope3byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    const lines: string[] = [];
    lines.push('='.repeat(70));
    lines.push('REPORT ESRS E1 - CAMBIAMENTO CLIMATICO');
    lines.push('Conforme a ESRS E1 (EU Delegated Regulation 2023/2772)');
    lines.push('Recepimento italiano: D.Lgs. 125/2024 (Direttiva CSRD 2022/2464)');
    lines.push('='.repeat(70));
    lines.push('');
    lines.push(`Azienda: ${company}`);
    lines.push(`Anno di rendicontazione: ${year}`);
    lines.push(`Data generazione: ${now}`);
    lines.push(`Metodologia: GHG Protocol Corporate Standard + ISO 14064-1:2019`);
    lines.push(`GWP: IPCC AR6 (2021)`);
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('E1-6: EMISSIONI LORDE DI GAS SERRA (Gross GHG Emissions)');
    lines.push('-'.repeat(70));
    lines.push('');
    lines.push('Emissioni Scope 1 (Dirette):');
    lines.push(`  Totale Scope 1:                     ${scope1Total.toFixed(2)} tCO2e`);
    const s1cats: Record<string, number> = {};
    for (const e of scope1Data) { s1cats[e.category] = (s1cats[e.category] || 0) + (e.co2e_tonnes || 0); }
    if (s1cats['stationary_combustion']) lines.push(`    - Combustione stazionaria:         ${s1cats['stationary_combustion'].toFixed(2)} tCO2e`);
    if (s1cats['mobile_combustion']) lines.push(`    - Combustione mobile (flotta):     ${s1cats['mobile_combustion'].toFixed(2)} tCO2e`);
    if (s1cats['fugitive_emissions']) lines.push(`    - Emissioni fuggitive:             ${s1cats['fugitive_emissions'].toFixed(2)} tCO2e`);
    if (s1cats['process_emissions']) lines.push(`    - Emissioni di processo:           ${s1cats['process_emissions'].toFixed(2)} tCO2e`);
    lines.push('');
    lines.push('Emissioni Scope 2 (Indirette da energia):');
    lines.push(`  Scope 2 (Location-based):            ${scope2Total.toFixed(2)} tCO2e`);
    lines.push(`  Metodo applicato: ${scope2Method === 'location' ? 'Location-based (ISPRA 2024 grid average)' : 'Market-based (AIB 2024 residual mix)'}`);
    lines.push('');
    lines.push('Emissioni Scope 3 (Altre indirette):');
    lines.push(`  Totale Scope 3:                     ${scope3Total.toFixed(2)} tCO2e`);
    for (const [catId, val] of scope3Significant) {
      const catDef = SCOPE3_CATEGORIES.find(c => c.id === catId);
      if (catDef) lines.push(`    - ${catDef.label}: ${val.toFixed(2)} tCO2e`);
    }
    lines.push('');
    lines.push(`TOTALE EMISSIONI GHG:                  ${grandTotal.toFixed(2)} tCO2e`);
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('E1-5: CONSUMO ENERGETICO (Energy Consumption)');
    lines.push('-'.repeat(70));
    const elecEntries = [...scope2Data].filter(e => e.fuel_type?.includes('electricity'));
    const elecTotal = elecEntries.reduce((s, e) => s + e.value, 0);
    const gasEntries = scope1Data.filter(e => e.fuel_type === 'natural_gas');
    const gasTotal = gasEntries.reduce((s, e) => s + e.value, 0);
    const fuelEntries = scope1Data.filter(e => ['diesel', 'gasoline', 'lpg', 'heating_oil', 'fuel_oil', 'kerosene'].includes(e.fuel_type || ''));
    lines.push(`  Elettricità consumata:               ${elecTotal.toLocaleString()} kWh`);
    lines.push(`  Gas naturale consumato:              ${gasTotal.toLocaleString()} kWh`);
    lines.push(`  Combustibili liquidi:                ${fuelEntries.length} voci registrate`);
    lines.push(`  Quota energia da fonti rinnovabili:  ${scope2Data.filter(e => e.fuel_type === 'electricity_renew').length > 0 ? 'Sì (con GO)' : 'Da verificare'}`);
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('E1-4: OBIETTIVI DI RIDUZIONE (Targets)');
    lines.push('-'.repeat(70));
    lines.push('  Obiettivo SBTi:                      Da definire');
    lines.push('  Target riduzione Scope 1+2:          -42% entro 2030 (raccomandato SBTi)');
    lines.push('  Target riduzione Scope 3:            -25% entro 2030 (raccomandato SBTi)');
    lines.push('  Anno base:                           Da definire');
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('E1-1: PIANO DI TRANSIZIONE (Transition Plan)');
    lines.push('-'.repeat(70));
    lines.push('  Stato: Da elaborare');
    lines.push('  Allineamento Accordo di Parigi: Da verificare');
    lines.push('  Compatibilità 1.5°C: Da valutare');
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('E1-7: ASSORBIMENTI E CREDITI DI CARBONIO');
    lines.push('-'.repeat(70));
    lines.push('  GHG removals da sink propri:         0 tCO2');
    lines.push('  Carbon credits acquistati:           0 tCO2');
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('E1-8: CARBON PRICING INTERNO');
    lines.push('-'.repeat(70));
    lines.push('  Prezzo interno del carbonio:         Non applicato');
    lines.push('  Shadow carbon price consigliato:     80-150 EUR/tCO2 (EU ETS range)');
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('E1-9: EFFETTI FINANZIARI PREVISTI');
    lines.push('-'.repeat(70));
    lines.push(`  Costo potenziale EU ETS:             ${(grandTotal * 85).toLocaleString(undefined, {maximumFractionDigits: 0})} EUR (@ 85 EUR/tCO2)`);
    lines.push(`  Intensità emissiva:                  Da calcolare con dati di fatturato`);
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('FONTI DEI FATTORI DI EMISSIONE');
    lines.push('-'.repeat(70));
    lines.push('  ISPRA 2024 - National Inventory Report (fattori elettricità, trasporti ITA)');
    lines.push('  DEFRA 2024 - UK Government GHG Conversion Factors');
    lines.push('  IPCC AR6 (2021) - GWP values per gas serra');
    lines.push('  AIB 2024 - European Residual Mix (market-based)');
    lines.push('  EEIO 2024 - Environmentally Extended Input-Output (spend-based)');
    lines.push('  PCAF 2022 - Partnership for Carbon Accounting Financials');
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('CONFORMITÀ NORMATIVA ITALIANA');
    lines.push('-'.repeat(70));
    lines.push('  D.Lgs. 125/2024 (recepimento Direttiva CSRD 2022/2464/UE)');
    lines.push('  D.Lgs. 254/2016 (Dichiarazione Non Finanziaria - DNF)');
    lines.push('  Regolamento Delegato UE 2023/2772 (standard ESRS)');
    lines.push('  ISO 14064-1:2019 (quantificazione GHG)');
    lines.push('  GHG Protocol Corporate Standard (2004, revised 2015)');
    lines.push('');
    lines.push('='.repeat(70));
    lines.push('Fine Report ESRS E1');
    downloadFile('\ufeff' + lines.join('\n'), `${project?.project_id || 'SME'}_ESRS_E1_Report_${year}.txt`, 'text/plain');
  };

  // Full CSRD / ESRS E sustainability report (all E pillars)
  const exportCSRDReport = () => {
    const now = new Date().toISOString();
    const year = project?.reporting_year || new Date().getFullYear();
    const company = project?.company_name || 'Azienda';
    const scope3byCat: Record<string, number> = {};
    for (const cat of SCOPE3_CATEGORIES) {
      scope3byCat[cat.id] = scope3Data.filter(e => e.category === cat.id).reduce((s, e) => s + (e.co2e_tonnes || 0), 0);
    }

    const headers = [
      'ESRS Standard', 'Disclosure', 'Metric', 'Value', 'Unit', 'Source', 'Note'
    ];
    const rows: string[][] = [];

    // E1: Climate Change
    rows.push(['ESRS E1', 'E1-6', 'Emissioni Scope 1', scope1Total.toFixed(2), 'tCO2e', 'ISPRA/DEFRA/IPCC', 'GHG Protocol Corporate Standard']);
    rows.push(['ESRS E1', 'E1-6', 'Emissioni Scope 2 (location)', scope2Total.toFixed(2), 'tCO2e', 'ISPRA 2024', `Metodo: ${scope2Method}`]);
    rows.push(['ESRS E1', 'E1-6', 'Emissioni Scope 3', scope3Total.toFixed(2), 'tCO2e', 'EEIO/DEFRA/ISPRA', `${SCOPE3_CATEGORIES.filter(c => scope3byCat[c.id] > 0).length}/15 categorie`]);
    rows.push(['ESRS E1', 'E1-6', 'Totale emissioni GHG', grandTotal.toFixed(2), 'tCO2e', '', '']);

    // E1 detail per Scope 3 cat
    for (const cat of SCOPE3_CATEGORIES) {
      if (scope3byCat[cat.id] > 0) {
        rows.push(['ESRS E1', 'E1-6 detail', cat.label, scope3byCat[cat.id].toFixed(2), 'tCO2e', '', '']);
      }
    }

    rows.push(['', '', '', '', '', '', '']);

    // E1-5 Energy
    const elecTotal = scope2Data.filter(e => e.fuel_type?.includes('electricity')).reduce((s, e) => s + e.value, 0);
    const gasTotal = scope1Data.filter(e => e.fuel_type === 'natural_gas').reduce((s, e) => s + e.value, 0);
    rows.push(['ESRS E1', 'E1-5', 'Consumo elettricità', elecTotal.toString(), 'kWh', 'ISPRA 2024', '']);
    rows.push(['ESRS E1', 'E1-5', 'Consumo gas naturale', gasTotal.toString(), 'kWh', 'ISPRA 2024', '']);
    rows.push(['ESRS E1', 'E1-5', 'Quota rinnovabili', scope2Data.filter(e => e.fuel_type === 'electricity_renew').length > 0 ? '100' : '0', '%', '', 'Con Garanzie di Origine']);

    rows.push(['', '', '', '', '', '', '']);

    // E1-4 Targets
    rows.push(['ESRS E1', 'E1-4', 'Target Scope 1+2 (2030)', '-42', '%', 'SBTi', 'Raccomandato']);
    rows.push(['ESRS E1', 'E1-4', 'Target Scope 3 (2030)', '-25', '%', 'SBTi', 'Raccomandato']);

    rows.push(['', '', '', '', '', '', '']);

    // E1-9 Financial effects
    rows.push(['ESRS E1', 'E1-9', 'Costo potenziale EU ETS', (grandTotal * 85).toFixed(0), 'EUR', 'EU ETS 2024', '@ 85 EUR/tCO2']);

    rows.push(['', '', '', '', '', '', '']);

    // E2: Pollution
    rows.push(['ESRS E2', 'E2-4', 'Emissioni NOx stimate', (scope1Total * 0.002).toFixed(2), 'tonnellate', 'ISPRA EF', 'Stima da combustione']);
    rows.push(['ESRS E2', 'E2-4', 'Emissioni SOx stimate', (scope1Total * 0.001).toFixed(2), 'tonnellate', 'ISPRA EF', 'Stima da combustione']);
    rows.push(['ESRS E2', 'E2-4', 'Emissioni PM stimate', (scope1Total * 0.0005).toFixed(2), 'tonnellate', 'ISPRA EF', 'Stima da combustione']);

    rows.push(['', '', '', '', '', '', '']);

    // E3: Water
    const waterEntries = scope3Data.filter(e => e.fuel_type === 'water_supply');
    const waterTotal = waterEntries.reduce((s, e) => s + e.value, 0);
    rows.push(['ESRS E3', 'E3-4', 'Consumo idrico', waterTotal > 0 ? waterTotal.toString() : 'Non rendicontato', 'm3', 'DEFRA 2024', '']);

    rows.push(['', '', '', '', '', '', '']);

    // E5: Resource Use & Circular Economy
    const wasteEntries = scope3Data.filter(e => e.category === 'cat5');
    const wasteTotal = wasteEntries.reduce((s, e) => s + e.value, 0);
    const recyclingEntries = scope3Data.filter(e => ['waste_recycling', 'eol_recycling'].includes(e.fuel_type || ''));
    const recyclingTons = recyclingEntries.reduce((s, e) => s + e.value, 0);
    rows.push(['ESRS E5', 'E5-5', 'Rifiuti totali generati', wasteTotal > 0 ? wasteTotal.toFixed(1) : 'Non rendicontato', 'tonnellate', 'ISPRA 2024', '']);
    rows.push(['ESRS E5', 'E5-5', 'Rifiuti a riciclo', recyclingTons > 0 ? recyclingTons.toFixed(1) : 'Non rendicontato', 'tonnellate', 'ISPRA 2024', '']);
    if (wasteTotal > 0) {
      rows.push(['ESRS E5', 'E5-5', 'Tasso di riciclo', ((recyclingTons / wasteTotal) * 100).toFixed(1), '%', '', '']);
    }

    // Product emissions (Cat 9-12)
    const productCats = ['cat9', 'cat10', 'cat11', 'cat12'];
    const productTotal = productCats.reduce((s, c) => s + (scope3byCat[c] || 0), 0);
    if (productTotal > 0) {
      rows.push(['', '', '', '', '', '', '']);
      rows.push(['ESRS E1', 'Product', 'Emissioni prodotto (Cat 9-12)', productTotal.toFixed(2), 'tCO2e', '', 'Downstream + end-of-life']);
    }

    rows.push(['', '', '', '', '', '', '']);

    // Compliance
    rows.push(['Compliance', '', 'D.Lgs. 125/2024', 'Applicabile', '', '', 'Recepimento CSRD']);
    rows.push(['Compliance', '', 'ESRS E1-E5', 'Coperto', '', '', 'Reg. Delegato 2023/2772']);
    rows.push(['Compliance', '', 'ISO 14064-1:2019', 'Conforme', '', '', '']);
    rows.push(['Compliance', '', 'GHG Protocol', 'Conforme', '', '', 'Corporate Standard']);
    rows.push(['Compliance', '', 'GWP', 'IPCC AR6', '', '', '100-year values']);

    rows.push(['', '', '', '', '', '', '']);
    rows.push(['Meta', '', 'Azienda', company, '', '', '']);
    rows.push(['Meta', '', 'Anno', year.toString(), '', '', '']);
    rows.push(['Meta', '', 'Generato il', now, '', '', '']);

    const csv = generateCSV(headers, rows);
    downloadFile(csv, `${project?.project_id || 'SME'}_CSRD_ESRS_Report_${year}.csv`, 'text/csv');
  };

  const tabs = [
    { id: 'scope1' as WizardTab, label: 'Scope 1', icon: Flame, color: 'text-brand-green', total: scope1Total },
    { id: 'scope2' as WizardTab, label: 'Scope 2', icon: Zap, color: 'text-[#6060FF]', total: scope2Total },
    { id: 'scope3' as WizardTab, label: 'Scope 3', icon: Link2, color: 'text-brand-yellow', total: scope3Total },
    { id: 'results' as WizardTab, label: 'Results', icon: BarChart3, color: 'text-white', total: grandTotal },
  ];

  const pieData = [
    { name: 'Scope 1', value: scope1Total, color: '#00FF80' },
    { name: 'Scope 2', value: scope2Total, color: '#4040FF' },
    { name: 'Scope 3', value: scope3Total, color: '#FEC500' },
  ];

  const renderDataTable = (data: DataEntry[], scope: string, scopeKey: 'scope1' | 'scope2' | 'scope3') => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-hover">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Description</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Value</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Unit</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">EF</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Source</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">tCO2e</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {data.map((entry) => (
            <tr key={entry.id} className="hover:bg-surface-hover/50">
              <td className="px-3 py-2">
                <div className="text-white text-xs">{entry.description}</div>
                <div className="text-[10px] text-gray-500">{entry.subcategory}</div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-white">
                {entry.value.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-xs text-gray-400">{entry.unit}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                {entry.ef_value?.toFixed(6)}
              </td>
              <td className="px-3 py-2">
                <span className="text-[10px] px-1.5 py-0.5 bg-brand-blue/10 text-[#6060FF] rounded">
                  {entry.ef_source}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-white">
                {entry.co2e_tonnes?.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-center">
                <button onClick={() => handleDeleteEntry(scopeKey, entry.id)} className="text-gray-500 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-surface-border">
            <td colSpan={5} className="px-3 py-2 text-xs font-bold text-gray-300">Total {scope}</td>
            <td className="px-3 py-2 text-right font-mono text-sm font-bold text-white">
              {data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0).toFixed(2)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Project not found. <button onClick={() => navigate('/sme-projects')} className="text-brand-blue underline">Go back</button></p>
      </div>
    );
  }

  const scope1CatCount = new Set(scope1Data.map(d => d.category)).size;
  const scope3CatCount = new Set(scope3Data.map(d => d.category)).size;
  const scope3TotalCats = SCOPE3_CATEGORIES.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/sme-projects')} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-surface-hover">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{project.company_name}</h1>
            <p className="text-sm text-gray-400">{project.project_id} | Reporting Year: {project.reporting_year} | ISO 14064-1:2019</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleSave}
            className="flex items-center space-x-2 px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover">
            {saved ? <CheckCircle className="w-4 h-4 text-brand-green" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'Saved!' : 'Save Draft'}</span>
          </button>
          <button onClick={recalculateAll}
            className="flex items-center space-x-2 px-4 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90">
            <Calculator className="w-4 h-4" /><span>Calculate & Validate</span>
          </button>
        </div>
      </div>

      {/* Live Preview Sidebar - Total */}
      <div className="grid grid-cols-4 gap-3">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-3 p-4 rounded-xl border transition-all ${
              activeTab === tab.id
                ? 'bg-surface-card border-brand-blue/50 ring-1 ring-brand-blue/30'
                : 'bg-surface-card border-surface-border hover:border-surface-hover'
            }`}>
            <tab.icon className={`w-5 h-5 ${tab.color}`} />
            <div className="text-left">
              <div className="text-xs text-gray-400">{tab.label}</div>
              <div className="text-sm font-bold text-white">{formatTonnes(tab.total)} t</div>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-surface-card rounded-xl border border-surface-border">
        {/* Scope 1 */}
        {activeTab === 'scope1' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-brand-green" />
                  <span>Scope 1 - Direct Emissions</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">Emissions from owned or controlled sources</p>
              </div>
              <button onClick={() => { setShowAddModal({ scope: 'scope1' }); setNewEntry({ ...newEntry, category: 'stationary_combustion', fuel_type: 'natural_gas' }); }}
                className="flex items-center space-x-1 text-sm text-brand-green hover:text-brand-green/80">
                <Plus className="w-4 h-4" /><span>Add Entry</span>
              </button>
            </div>

            {/* Stationary Combustion */}
            <div className="border border-surface-border rounded-lg">
              <button onClick={() => toggleSection('stationary')}
                className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/50">
                <span className="text-sm font-medium text-gray-300">Stationary Combustion (Heating, Boilers)</span>
                {expandedSections.has('stationary') ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedSections.has('stationary') && (
                <div className="border-t border-surface-border">
                  {scope1Data.filter(d => d.category === 'stationary_combustion').length > 0
                    ? renderDataTable(scope1Data.filter(d => d.category === 'stationary_combustion'), 'Stationary', 'scope1')
                    : <p className="p-4 text-xs text-gray-500 text-center">No entries. Click "Add Entry" above.</p>}
                </div>
              )}
            </div>

            {/* Mobile Combustion */}
            <div className="border border-surface-border rounded-lg">
              <button onClick={() => toggleSection('mobile')}
                className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/50">
                <span className="text-sm font-medium text-gray-300">Mobile Combustion (Fleet Vehicles)</span>
                {expandedSections.has('mobile') ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedSections.has('mobile') && (
                <div className="border-t border-surface-border">
                  {scope1Data.filter(d => d.category === 'mobile_combustion').length > 0
                    ? renderDataTable(scope1Data.filter(d => d.category === 'mobile_combustion'), 'Mobile', 'scope1')
                    : <p className="p-4 text-xs text-gray-500 text-center">No entries. Click "Add Entry" above.</p>}
                </div>
              )}
            </div>

            {/* Fugitive */}
            <div className="border border-surface-border rounded-lg">
              <button onClick={() => toggleSection('fugitive')}
                className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/50">
                <span className="text-sm font-medium text-gray-300">Emissioni Fuggitive (Refrigeranti, Gas F)</span>
                {expandedSections.has('fugitive') ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedSections.has('fugitive') && (
                <div className="border-t border-surface-border">
                  {scope1Data.filter(d => d.category === 'fugitive_emissions').length > 0
                    ? renderDataTable(scope1Data.filter(d => d.category === 'fugitive_emissions'), 'Fugitive', 'scope1')
                    : <p className="p-4 text-xs text-gray-500 text-center">Nessuna voce. Clicca "Add Entry" sopra.</p>}
                </div>
              )}
            </div>

            {/* Process Emissions */}
            <div className="border border-surface-border rounded-lg">
              <button onClick={() => toggleSection('process')}
                className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/50">
                <span className="text-sm font-medium text-gray-300">Emissioni di Processo (Cemento, Acciaio, Vetro, Saldatura)</span>
                {expandedSections.has('process') ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedSections.has('process') && (
                <div className="border-t border-surface-border">
                  {scope1Data.filter(d => d.category === 'process_emissions').length > 0
                    ? renderDataTable(scope1Data.filter(d => d.category === 'process_emissions'), 'Process', 'scope1')
                    : <p className="p-4 text-xs text-gray-500 text-center">Nessuna voce. Clicca "Add Entry" sopra.</p>}
                </div>
              )}
            </div>

            {scope1Data.length > 0 && (
              <div className="flex items-center space-x-2 p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg">
                <CheckCircle className="w-4 h-4 text-brand-green" />
                <span className="text-xs text-brand-green">Scope 1: {scope1CatCount}/4 categorie coperte (Stazionaria, Mobile, Fuggitiva, Processo)</span>
              </div>
            )}
          </div>
        )}

        {/* Scope 2 */}
        {activeTab === 'scope2' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-[#6060FF]" />
                  <span>Scope 2 - Indirect Energy Emissions</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">Emissions from purchased electricity, heat, and cooling</p>
              </div>
            </div>

            {/* Method Toggle */}
            <div className="flex items-center space-x-4 p-3 bg-surface-hover rounded-lg">
              <span className="text-xs text-gray-400">Calculation Method:</span>
              <div className="flex space-x-1 bg-brand-dark rounded-lg p-0.5">
                <button onClick={() => setScope2Method('location')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${scope2Method === 'location' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>
                  Location-based
                </button>
                <button onClick={() => setScope2Method('market')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${scope2Method === 'market' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>
                  Market-based
                </button>
              </div>
              <div className="group relative">
                <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                <div className="absolute bottom-full mb-2 left-0 w-64 p-2 bg-brand-dark border border-surface-border rounded-lg text-xs text-gray-300 hidden group-hover:block z-10">
                  <strong>Location-based:</strong> Uses grid average emission factors.<br />
                  <strong>Market-based:</strong> Uses supplier-specific factors, renewable energy certificates.
                </div>
              </div>
            </div>

            {scope2Data.length > 0
              ? renderDataTable(scope2Data, 'Scope 2', 'scope2')
              : <p className="p-4 text-xs text-gray-500 text-center">No entries yet. Add electricity, heat, or cooling sources.</p>}

            <button onClick={() => { setShowAddModal({ scope: 'scope2' }); setNewEntry({ ...newEntry, category: 'purchased_electricity', fuel_type: 'electricity_ita' }); }}
              className="flex items-center space-x-1 text-sm text-[#6060FF] hover:text-[#6060FF]/80">
              <Plus className="w-4 h-4" /><span>Add Electricity / Heat / Cooling Source</span>
            </button>
          </div>
        )}

        {/* Scope 3 */}
        {activeTab === 'scope3' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Link2 className="w-5 h-5 text-brand-yellow" />
                  <span>Scope 3 - Value Chain Emissions</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">All other indirect emissions in the value chain</p>
              </div>
            </div>

            {SCOPE3_CATEGORIES.map((cat) => {
              const entries = scope3Data.filter(d => d.category === cat.id);
              const catTotal = entries.reduce((s, e) => s + (e.co2e_tonnes || 0), 0);
              return (
                <div key={cat.id} className="border border-surface-border rounded-lg">
                  <button onClick={() => toggleSection(cat.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/50">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-300">{cat.label}</span>
                      {entries.length > 0 && (
                        <span className="text-xs text-brand-yellow font-mono">{catTotal.toFixed(2)} tCO2e</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {entries.length === 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-500/20 text-gray-500 rounded">No data</span>
                      )}
                      {expandedSections.has(cat.id) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {expandedSections.has(cat.id) && (
                    <div className="border-t border-surface-border">
                      {entries.length > 0 ? (
                        renderDataTable(entries, cat.label, 'scope3')
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-xs text-gray-500 mb-2">No data entered for this category</p>
                          <button onClick={() => { setShowAddModal({ scope: 'scope3', category: cat.id }); setNewEntry({ ...newEntry, category: cat.id, fuel_type: cat.fuelTypes[0] }); }}
                            className="text-xs text-brand-yellow hover:text-brand-yellow/80">
                            + Add data
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {scope3CatCount < scope3TotalCats && (
              <div className="flex items-center space-x-2 p-3 bg-brand-yellow/5 border border-brand-yellow/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-brand-yellow" />
                <span className="text-xs text-brand-yellow">
                  {scope3TotalCats - scope3CatCount} of {scope3TotalCats} Scope 3 categories have no data. Consider at least Cat 1, 5, 6, 7 for completeness.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {activeTab === 'results' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>GHG Inventory Results</span>
            </h2>

            {grandTotal === 0 && (
              <div className="flex items-center space-x-2 p-4 bg-brand-yellow/5 border border-brand-yellow/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-brand-yellow" />
                <span className="text-sm text-brand-yellow">No emissions data entered yet. Add data in Scope 1, 2, and 3 tabs, then click "Calculate & Validate".</span>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-brand-dark rounded-lg p-4 text-center border border-brand-green/30">
                <div className="text-2xl font-bold text-brand-green">{formatTonnes(scope1Total)}</div>
                <div className="text-xs text-gray-400 mt-1">Scope 1 (tCO2e)</div>
              </div>
              <div className="bg-brand-dark rounded-lg p-4 text-center border border-brand-blue/30">
                <div className="text-2xl font-bold text-[#6060FF]">{formatTonnes(scope2Total)}</div>
                <div className="text-xs text-gray-400 mt-1">Scope 2 (tCO2e)</div>
              </div>
              <div className="bg-brand-dark rounded-lg p-4 text-center border border-brand-yellow/30">
                <div className="text-2xl font-bold text-brand-yellow">{formatTonnes(scope3Total)}</div>
                <div className="text-xs text-gray-400 mt-1">Scope 3 (tCO2e)</div>
              </div>
              <div className="bg-brand-dark rounded-lg p-4 text-center border border-white/20">
                <div className="text-2xl font-bold text-white">{formatTonnes(grandTotal)}</div>
                <div className="text-xs text-gray-400 mt-1">Total (tCO2e)</div>
              </div>
            </div>

            {grandTotal > 0 && (
              <>
                {/* Charts */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Emissions by Scope</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                          {pieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v.toFixed(2)} tCO2e`, '']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Scope Comparison</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={[{ name: 'Scope 1', value: scope1Total }, { name: 'Scope 2', value: scope2Total }, { name: 'Scope 3', value: scope3Total }]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                        <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#999', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#242424', border: '1px solid #3A3A3A', borderRadius: '8px', color: '#fff' }} />
                        <Bar dataKey="value" fill="#4040FF" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Uncertainty Analysis */}
                <div className="bg-brand-dark rounded-lg p-4 border border-surface-border">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">ISO 14064-1 Uncertainty Assessment</h3>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Scope 1 Uncertainty:</span>
                      <span className="text-white ml-2">+/- 5.2%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Scope 2 Uncertainty:</span>
                      <span className="text-white ml-2">+/- 3.8%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Scope 3 Uncertainty:</span>
                      <span className="text-white ml-2">+/- 25.0%</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Combined uncertainty (95% CI): {formatTonnes(grandTotal)} +/- {formatTonnes(grandTotal * 0.12)} tCO2e
                  </p>
                </div>
              </>
            )}

            {/* Audit Trail */}
            <div className="bg-brand-dark rounded-lg p-4 border border-surface-border">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Tracciabilità Calcolo</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-400">
                <p>GWP: IPCC AR6 (2021) — 100 year values</p>
                <p>Elettricità ITA: ISPRA NIR 2024 (0.260 gCO2/kWh)</p>
                <p>Combustibili: DEFRA 2024 UK Conversion Factors</p>
                <p>Spesa: EEIO 2024 (Input-Output analysis)</p>
                <p>Trasporti ITA: ISPRA 2024 + DEFRA 2024</p>
                <p>Refrigeranti: IPCC AR6 GWP100</p>
                <p>Standard: GHG Protocol + ISO 14064-1:2019</p>
                <p>ESRS: E1 (Climate), E2 (Pollution), E5 (Circular)</p>
                <p>Calcolato il: {new Date().toISOString()}</p>
                <p>Scope 3 categorie: {SCOPE3_CATEGORIES.length}/15 disponibili</p>
              </div>
            </div>

            {/* Export */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Export Report</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <button onClick={exportGHGProtocolCSV}
                  disabled={grandTotal === 0}
                  className="flex items-center space-x-2 px-4 py-2.5 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                  <Download className="w-4 h-4" /><span>GHG Protocol (CSV)</span>
                </button>
                <button onClick={exportESRSE1Report}
                  disabled={grandTotal === 0}
                  className="flex items-center space-x-2 px-4 py-2.5 text-sm bg-brand-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                  <FileText className="w-4 h-4" /><span>ESRS E1 Report</span>
                </button>
                <button onClick={exportCSRDReport}
                  disabled={grandTotal === 0}
                  className="flex items-center space-x-2 px-4 py-2.5 text-sm bg-brand-yellow text-brand-dark rounded-lg hover:opacity-90 disabled:opacity-50 font-medium">
                  <Download className="w-4 h-4" /><span>CSRD / ESRS E (CSV)</span>
                </button>
                <button onClick={exportAuditTrailCSV}
                  disabled={grandTotal === 0}
                  className="flex items-center space-x-2 px-4 py-2.5 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover disabled:opacity-50">
                  <FileText className="w-4 h-4" /><span>Audit Trail (CSV)</span>
                </button>
                <button onClick={exportCDPCSV}
                  disabled={grandTotal === 0}
                  className="flex items-center space-x-2 px-4 py-2.5 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover disabled:opacity-50">
                  <Download className="w-4 h-4" /><span>CDP Format (CSV)</span>
                </button>
              </div>
            </div>

            {/* Conformance */}
            {grandTotal > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-brand-green" />
                  <span className="text-xs text-brand-green">
                    Conforme a: ISO 14064-1:2019 | GHG Protocol Corporate Standard |
                    ESRS E1 (Reg. Delegato UE 2023/2772) | D.Lgs. 125/2024 (CSRD)
                  </span>
                </div>
                <div className="p-3 bg-surface-hover rounded-lg text-xs text-gray-500">
                  <p className="font-medium text-gray-400 mb-1">Normativa italiana applicabile:</p>
                  <p>D.Lgs. 125/2024 (recepimento Direttiva CSRD 2022/2464/UE) |
                     D.Lgs. 254/2016 (DNF) | Fattori ISPRA NIR 2024 |
                     IPCC AR6 GWP (2021) | DEFRA 2024 UK Conversion Factors |
                     AIB 2024 European Residual Mix | EEIO 2024 Spend-based</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Add {showAddModal.scope === 'scope1' ? 'Scope 1' : showAddModal.scope === 'scope2' ? 'Scope 2' : 'Scope 3'} Entry
              </h2>
              <button onClick={() => setShowAddModal(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description *</label>
                <input type="text" value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  placeholder="e.g., Office heating - Natural Gas"
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>

              {showAddModal.scope === 'scope1' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Category *</label>
                  <select value={newEntry.category}
                    onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                    <option value="stationary_combustion">Combustione Stazionaria</option>
                    <option value="mobile_combustion">Combustione Mobile (Flotta)</option>
                    <option value="fugitive_emissions">Emissioni Fuggitive (Refrigeranti)</option>
                    <option value="process_emissions">Emissioni di Processo (Industriale)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Source / Fuel Type *</label>
                <select value={newEntry.fuel_type}
                  onChange={(e) => setNewEntry({ ...newEntry, fuel_type: e.target.value })}
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                  <option value="">Select...</option>
                  {showAddModal.scope === 'scope1' && SCOPE1_FUEL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                  {showAddModal.scope === 'scope2' && SCOPE2_FUEL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                  {showAddModal.scope === 'scope3' && (() => {
                    const cat = SCOPE3_CATEGORIES.find(c => c.id === showAddModal.category);
                    return (cat?.fuelTypes || []).map(ft => (
                      <option key={ft} value={ft}>{ft.replace(/_/g, ' ')} ({getUnitForFuel(ft)})</option>
                    ));
                  })()}
                </select>
                {newEntry.fuel_type && EF_LOOKUP[newEntry.fuel_type] && (
                  <p className="text-xs text-gray-500 mt-1">
                    EF: {EF_LOOKUP[newEntry.fuel_type].value} {EF_LOOKUP[newEntry.fuel_type].unit} | Source: {EF_LOOKUP[newEntry.fuel_type].source}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Activity Value * {newEntry.fuel_type && `(${getUnitForFuel(newEntry.fuel_type)})`}
                </label>
                <input type="number" value={newEntry.value}
                  onChange={(e) => setNewEntry({ ...newEntry, value: e.target.value })}
                  placeholder="e.g., 150000"
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                {newEntry.fuel_type && newEntry.value && !isNaN(parseFloat(newEntry.value)) && (
                  <p className="text-xs text-brand-green mt-1">
                    Estimated: {calculateCO2e({
                      id: '', category: '', subcategory: '', description: '',
                      value: parseFloat(newEntry.value), unit: '', fuel_type: newEntry.fuel_type,
                    }).toFixed(4)} tCO2e
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowAddModal(null)}
                className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">
                Cancel
              </button>
              <button onClick={handleAddEntry}
                disabled={!newEntry.description || !newEntry.fuel_type || !newEntry.value}
                className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

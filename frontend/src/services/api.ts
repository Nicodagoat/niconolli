import axios from 'axios';
import type {
  Organization, Facility, Inventory, Activity, ActivityCreate,
  EmissionFactor, CalculationResult, InventorySummary, EmissionsTrend,
  ScopeBreakdown, Client, ClientCreate, DEASPProject, DEASPProjectCreate,
  DashboardSummary,
} from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const authAPI = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string }>('/auth/login', { email, password }),
  register: (data: { email: string; password: string; full_name: string; organization_id: string }) =>
    api.post('/auth/register', data),
};

// Organizations
export const orgAPI = {
  list: () => api.get<Organization[]>('/organizations/'),
  get: (id: string) => api.get<Organization>(`/organizations/${id}`),
  create: (data: Partial<Organization>) => api.post<Organization>('/organizations/', data),
  update: (id: string, data: Partial<Organization>) => api.patch<Organization>(`/organizations/${id}`, data),
  listFacilities: (orgId: string) => api.get<Facility[]>(`/organizations/${orgId}/facilities`),
  createFacility: (orgId: string, data: Partial<Facility>) =>
    api.post<Facility>(`/organizations/${orgId}/facilities`, data),
};

// Inventories
export const inventoryAPI = {
  list: (orgId: string) => api.get<Inventory[]>('/inventories/', { params: { org_id: orgId } }),
  get: (id: string) => api.get<Inventory>(`/inventories/${id}`),
  create: (orgId: string, data: Partial<Inventory>) =>
    api.post<Inventory>('/inventories/', data, { params: { org_id: orgId } }),
  update: (id: string, data: Partial<Inventory>) => api.patch<Inventory>(`/inventories/${id}`, data),
  delete: (id: string) => api.delete(`/inventories/${id}`),
};

// Activities
export const activityAPI = {
  list: (inventoryId: string, scope?: string, category?: string) =>
    api.get<Activity[]>(`/activities/${inventoryId}`, { params: { scope, category } }),
  get: (id: string) => api.get<Activity>(`/activities/detail/${id}`),
  create: (inventoryId: string, data: ActivityCreate) =>
    api.post<Activity>(`/activities/${inventoryId}`, data),
  bulkCreate: (inventoryId: string, activities: ActivityCreate[]) =>
    api.post(`/activities/${inventoryId}/bulk`, { activities }),
  uploadCSV: (inventoryId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/activities/${inventoryId}/upload-csv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getTemplate: () => api.get('/activities/template', { responseType: 'blob' }),
  update: (id: string, data: Partial<Activity>) => api.patch<Activity>(`/activities/detail/${id}`, data),
  delete: (id: string) => api.delete(`/activities/detail/${id}`),
};

// Emission Factors
export const factorAPI = {
  list: (params?: Record<string, string | number>) =>
    api.get<EmissionFactor[]>('/emission-factors/', { params }),
  get: (id: string) => api.get<EmissionFactor>(`/emission-factors/${id}`),
  create: (data: Partial<EmissionFactor>) => api.post<EmissionFactor>('/emission-factors/', data),
  update: (id: string, data: Partial<EmissionFactor>) =>
    api.patch<EmissionFactor>(`/emission-factors/${id}`, data),
  getHistory: (id: string) => api.get(`/emission-factors/${id}/history`),
  seedDefaults: () => api.post('/emission-factors/seed-defaults'),
};

// Calculations
export const calculationAPI = {
  calculate: (inventoryId: string) =>
    api.post<{ status: string; calculated: number; total_co2e_tonnes: number }>(
      `/calculations/${inventoryId}/calculate`
    ),
  getResults: (inventoryId: string) =>
    api.get<CalculationResult[]>(`/calculations/${inventoryId}/results`),
  getSummary: (inventoryId: string) =>
    api.get<InventorySummary>(`/calculations/${inventoryId}/summary`),
  getBreakdown: (inventoryId: string) =>
    api.get<ScopeBreakdown[]>(`/calculations/${inventoryId}/breakdown`),
  getTrends: (inventoryId: string) =>
    api.get<EmissionsTrend[]>(`/calculations/${inventoryId}/trends`),
};

// Reports
export const reportAPI = {
  ghgProtocol: (inventoryId: string) => api.get(`/reports/${inventoryId}/ghg-protocol`),
  cdp: (inventoryId: string) => api.get(`/reports/${inventoryId}/cdp`),
  exportCalculationsCSV: (inventoryId: string) =>
    api.get(`/reports/${inventoryId}/export/calculations-csv`, { responseType: 'blob' }),
  exportActivitiesCSV: (inventoryId: string) =>
    api.get(`/reports/${inventoryId}/export/activities-csv`, { responseType: 'blob' }),
};

// Clients
export const clientAPI = {
  list: (status?: string) => api.get<Client[]>('/clients/', { params: status ? { status } : undefined }),
  get: (id: string) => api.get<Client>(`/clients/${id}`),
  create: (data: ClientCreate) => api.post<Client>('/clients/', data),
  update: (id: string, data: Partial<Client>) => api.put<Client>(`/clients/${id}`, data),
  getEmissions: (id: string) => api.get(`/clients/${id}/emissions`),
};

// DEASP Projects
export const deaspProjectAPI = {
  list: (clientId?: string, status?: string) =>
    api.get<DEASPProject[]>('/deasp-projects/', { params: { client_id: clientId, status } }),
  get: (id: string) => api.get<DEASPProject>(`/deasp-projects/${id}`),
  create: (data: DEASPProjectCreate) => api.post<DEASPProject>('/deasp-projects/', data),
  update: (id: string, data: Partial<DEASPProject>) => api.put<DEASPProject>(`/deasp-projects/${id}`, data),
  getProgress: (id: string) => api.get(`/deasp-projects/${id}/progress`),
};

// Dashboard
export const dashboardAPI = {
  getSummary: () => api.get<DashboardSummary>('/dashboard/summary'),
};

export default api;

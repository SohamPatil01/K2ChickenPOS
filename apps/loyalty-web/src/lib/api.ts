import axios from 'axios';

const TOKEN_KEY = 'k2-loyalty-token';

export type PortalCustomer = {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  loyaltyTier: string;
  referralCode?: string | null;
  area?: string | null;
};

export type PortalAddress = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  zip: string | null;
} | null;

export type PortalProfileMeta = {
  isComplete: boolean;
  missing: Array<'name' | 'address'>;
  completionPercent: number;
};

export type PortalReward = {
  percent: number;
  status: 'PENDING' | 'REDEEMED' | null;
  source: string | null;
  completedAt: string | null;
  pending: boolean;
  redeemed: boolean;
};

export type PortalProfile = {
  customer: PortalCustomer;
  address: PortalAddress;
  profile: PortalProfileMeta;
  reward: PortalReward;
};

export type ProfileUpdateInput = {
  name: string;
  area?: string;
  address: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    zip?: string;
  };
};

function apiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return '';
  }
  return process.env.NEXT_PUBLIC_API_URL || '';
}

export const api = axios.create({
  baseURL: apiBase(),
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function portalLogin(phone: string, pin: string) {
  const { data } = await api.post('/api/v1/portal/login', { phone, pin });
  setToken(data.accessToken);
  return data.customer as PortalCustomer;
}

export async function portalRegister(
  name: string,
  phone: string,
  pin: string,
  referralCode?: string
) {
  const { data } = await api.post('/api/v1/portal/register', {
    name,
    phone,
    pin,
    ...(referralCode ? { referralCode } : {}),
  });
  setToken(data.accessToken);
  return data.customer as PortalCustomer;
}

export async function portalMe() {
  const { data } = await api.get('/api/v1/portal/me');
  return data as PortalProfile;
}

export async function portalUpdateProfile(input: ProfileUpdateInput) {
  const { data } = await api.put('/api/v1/portal/profile', input);
  return data as PortalProfile;
}

export async function portalChangePin(currentPin: string, newPin: string) {
  await api.post('/api/v1/portal/change-pin', { currentPin, newPin });
}

export function logout() {
  setToken(null);
}

export const SHOP_WEBSITE = 'https://www.k2chicken.com';

'use client';

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, APP_NAME } from '@azela-pos/shared';
import type { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Crown,
  ShieldCheck,
  Calculator,
  Truck,
  User,
  ArrowLeft,
  AlertCircle,
  Delete,
  Zap,
  WifiOff,
  BarChart3,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import NumPad from '@/components/NumPad';
import { BrandLoader } from '@/components/ui';
import { scaleIn, useMotionSafe } from '@/lib/motion';

type LoginFormData = z.infer<typeof loginSchema>;

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'DRIVER';
}

const roleMeta: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; badge: string; avatar: string }
> = {
  OWNER: {
    icon: Crown,
    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
    avatar: 'from-purple-500 to-fuchsia-600',
  },
  MANAGER: {
    icon: ShieldCheck,
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    avatar: 'from-blue-500 to-cyan-600',
  },
  CASHIER: {
    icon: Calculator,
    badge: 'bg-green-500/15 text-green-700 dark:text-green-300',
    avatar: 'from-green-500 to-emerald-600',
  },
  DRIVER: {
    icon: Truck,
    badge: 'bg-brand-500/15 text-brand-700 dark:text-brand-300',
    avatar: 'from-brand-400 to-brand-600',
  },
};

const fallbackMeta = {
  icon: User,
  badge: 'bg-surface-2 text-ink-secondary',
  avatar: 'from-gray-400 to-gray-600',
};

export default function LoginPage() {
  const { setAuth } = useAuthStore();
  const motionSafe = useMotionSafe();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordPad, setShowPasswordPad] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  // Fetch user profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const response = await api.get('/api/v1/auth/profiles');
        setProfiles(response.data || []);
      } catch (err: any) {
        console.error('Failed to fetch profiles:', err);
        setError('Failed to load user profiles');
      } finally {
        setLoadingProfiles(false);
      }
    };

    fetchProfiles();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const stored = localStorage.getItem('auth-storage');
    let hasUser = false;
    try {
      if (stored) {
        const parsed = JSON.parse(stored);
        hasUser = !!parsed.state?.user;
      }
    } catch (e) {
      // Ignore
    }

    if (token && hasUser && !loading) {
      window.location.href = '/pos';
    }
  }, [loading]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: '',
      password: '',
    },
  });

  // Sync form values with state
  useEffect(() => {
    if (selectedProfile) {
      setValue('phone', selectedProfile.phone);
    }
  }, [selectedProfile, setValue]);

  useEffect(() => {
    setValue('password', password);
  }, [password, setValue]);

  const handleProfileSelect = (profile: UserProfile) => {
    setSelectedProfile(profile);
    setPassword('');
    setError(null);
    setShowPasswordPad(true);
  };

  const handleBackToProfiles = () => {
    setSelectedProfile(null);
    setPassword('');
    setError(null);
    setShowPasswordPad(false);
  };

  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    if (!selectedProfile) {
      setError('Please select a user profile');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/v1/auth/login', {
        phone: selectedProfile.phone,
        password: password || data.password,
      });

      if (!response.data) {
        throw new Error('No data in response');
      }

      const { user, accessToken, refreshToken } = response.data;

      if (!user || !accessToken) {
        throw new Error('Invalid response from server');
      }

      setAuth(user, accessToken, refreshToken);

      // Arm the post-login welcome splash (WelcomeSplash reads and
      // clears this on the next page load, then slides out).
      try {
        sessionStorage.setItem('azeela-welcome', user.name || 'there');
      } catch {
        // Non-fatal — splash is purely cosmetic
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      window.location.href = '/pos';

    } catch (err: any) {
      let errorMessage = 'Login failed. Please check your credentials.';

      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to server. Please check if the API server is running.';
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  const selectedMeta = selectedProfile
    ? roleMeta[selectedProfile.role] ?? fallbackMeta
    : fallbackMeta;

  return (
    <div className="min-h-screen flex safe-top safe-bottom relative overflow-hidden">
      {/* Living gradient wash + ambient brand glow (behind all content) */}
      <div className="app-gradient-wash pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <div className="app-glow-layer pointer-events-none fixed inset-0 -z-10 bg-app-glow" aria-hidden />

      {/* Left brand panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[40%] relative flex-col justify-between p-10 xl:p-14 bg-gradient-brand text-white overflow-hidden">
        {/* Decorative rings */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full border border-white/15" aria-hidden />
        <div className="pointer-events-none absolute -top-10 -right-10 h-64 w-64 rounded-full border border-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-white/5" aria-hidden />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm text-xl font-bold border border-white/25">
            A
          </span>
          <span className="text-xl font-bold tracking-tight">{APP_NAME || 'AzeelaAiPos'}</span>
        </div>

        <div className="relative">
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight !text-white">
            Run your store
            <br />
            at full speed.
          </h1>
          <p className="mt-4 text-white/85 text-base xl:text-lg max-w-sm">
            Billing, inventory and insights in one fast, offline-ready point of sale.
          </p>

          <div className="mt-8 flex flex-col gap-3 text-sm text-white/85">
            <span className="inline-flex items-center gap-2.5">
              <Zap className="h-4 w-4" /> Instant barcode billing
            </span>
            <span className="inline-flex items-center gap-2.5">
              <WifiOff className="h-4 w-4" /> Works even when offline
            </span>
            <span className="inline-flex items-center gap-2.5">
              <BarChart3 className="h-4 w-4" /> Live sales analytics
            </span>
          </div>
        </div>

        <p className="relative text-xs text-white/60">
          © {new Date().getFullYear()} {APP_NAME || 'AzeelaAiPos'}
        </p>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile-only brand header */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand text-white text-2xl font-bold shadow-glow-brand mb-3">
              A
            </span>
            <span className="text-2xl font-bold text-gradient-brand">
              {APP_NAME || 'AzeelaAiPos'}
            </span>
          </div>

          {error && (
            <div className="glass-panel-strong flex items-center gap-2 border-red-500/40 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl mb-5">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {!selectedProfile ? (
            // ---------- Profile selection ----------
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-ink-muted mt-1.5 mb-7">
                Choose your profile to sign in
              </p>

              {loadingProfiles ? (
                <div className="flex justify-center items-center py-16">
                  <BrandLoader label="Loading profiles…" />
                </div>
              ) : profiles.length === 0 ? (
                <div className="glass-panel rounded-2xl text-center py-12 px-6 text-ink-muted text-sm">
                  No users available. Please contact your administrator.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {profiles.map((profile, index) => {
                    const meta = roleMeta[profile.role] ?? fallbackMeta;
                    const RoleIcon = meta.icon;
                    return (
                      <button
                        key={profile.id}
                        style={
                          motionSafe
                            ? { animationDelay: `${index * 50}ms`, animationFillMode: 'both' }
                            : undefined
                        }
                        onClick={() => handleProfileSelect(profile)}
                        className={`glass-panel group flex items-center gap-4 rounded-2xl p-3.5 sm:p-4 text-left touch-target transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow-brand hover:border-brand-500/30 active:translate-y-0 active:scale-[0.99] ${
                          motionSafe ? 'animate-fade-in-up' : ''
                        }`}
                      >
                        <span
                          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${meta.avatar} text-white text-lg font-bold shadow-sm`}
                        >
                          {profile.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold text-ink truncate">
                            {profile.name}
                          </span>
                          <span
                            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${meta.badge}`}
                          >
                            <RoleIcon className="h-3 w-3" />
                            {profile.role.toLowerCase()}
                          </span>
                        </span>
                        <span className="text-ink-muted group-hover:text-brand-500 transition-colors text-lg" aria-hidden>
                          ›
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // ---------- PIN entry ----------
            <motion.form
              onSubmit={handleSubmit(onSubmit)}
              variants={motionSafe ? scaleIn : undefined}
              initial={motionSafe ? 'hidden' : false}
              animate="show"
            >
              <button
                type="button"
                onClick={handleBackToProfiles}
                className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6 touch-target"
              >
                <ArrowLeft className="h-4 w-4" />
                All profiles
              </button>

              <div className="flex flex-col items-center text-center mb-7">
                <span
                  className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${selectedMeta.avatar} text-white text-2xl font-bold shadow-glow-brand mb-3`}
                >
                  {selectedProfile.name.charAt(0).toUpperCase()}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-ink">
                  Hi, {selectedProfile.name.split(' ')[0]}
                </h2>
                <p className="text-sm text-ink-muted mt-1">Enter your PIN to continue</p>
              </div>

              {/* Hidden form field keeps react-hook-form/zod wiring intact */}
              <input type="hidden" {...register('password')} value={password} readOnly />

              {/* PIN dots */}
              <button
                type="button"
                onClick={() => setShowPasswordPad(true)}
                className="w-full flex items-center justify-center gap-2.5 min-h-[64px] glass-panel rounded-2xl mb-2 touch-target transition-all hover:border-brand-500/40"
                aria-label="Enter PIN"
              >
                {password.length === 0 ? (
                  <span className="text-sm text-ink-muted">Tap to enter PIN</span>
                ) : (
                  Array.from({ length: password.length }).map((_, i) => (
                    <span
                      key={i}
                      className="h-3.5 w-3.5 rounded-full bg-gradient-brand shadow-glow-brand"
                    />
                  ))
                )}
              </button>
              {password.length > 0 && (
                <div className="flex justify-end mb-1">
                  <button
                    type="button"
                    onClick={() => setPassword(password.slice(0, -1))}
                    className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink px-2 py-1.5 touch-target"
                  >
                    <Delete className="h-3.5 w-3.5" /> Clear last digit
                  </button>
                </div>
              )}
              {errors.password && (
                <p className="text-red-500 text-sm mt-1 mb-2 text-center">
                  {errors.password.message?.toString() || 'Invalid PIN'}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="mt-4 w-full bg-gradient-brand text-white py-4 px-4 rounded-2xl shadow-glow-brand hover:shadow-glow-brand-lg hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none touch-target text-lg font-semibold transition-all duration-200"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </motion.form>
          )}

          {/* Password/PIN NumPad */}
          {showPasswordPad && (
            <NumPad
              value={password}
              onChange={(value) => setPassword(value)}
              onClose={() => setShowPasswordPad(false)}
              placeholder="Enter PIN"
              maxLength={20}
              maskValue={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}

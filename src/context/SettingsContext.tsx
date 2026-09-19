import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppSettings, Profile } from '@/types'
import { financeService } from '@/services/finance.service'
import { useAuth } from './AuthContext'

interface SettingsCtx {
  settings: AppSettings | null
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
  saveSettings: (s: Partial<AppSettings>) => Promise<void>
  saveProfile: (p: Partial<Profile>) => Promise<void>
  aiEnabled: boolean
}

const Ctx = createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) { setSettings(null); setProfile(null); setLoading(false); return }
    try {
      const [s, p] = await Promise.all([financeService.getSettings(), financeService.getProfile()])
      setSettings(s); setProfile(p)
    } catch (e) { console.error('settings', e) } finally { setLoading(false) }
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return (
    <Ctx.Provider value={{
      settings, profile, loading, refresh, aiEnabled: Boolean(settings?.ai_enabled),
      saveSettings: async (s) => setSettings(await financeService.saveSettings(s)),
      saveProfile: async (p) => setProfile(await financeService.saveProfile(p)),
    }}>{children}</Ctx.Provider>
  )
}

export const useSettings = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSettings fuera de SettingsProvider')
  return c
}

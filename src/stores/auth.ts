import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ServiceKey } from '@/types';

interface Profile {
  display_name: string;
  preferred_service: ServiceKey;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const profile = ref<Profile | null>(null);
  const loading = ref(true);
  let initPromise: Promise<void> | null = null;

  async function loadProfile() {
    if (!user.value) {
      profile.value = null;
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('display_name, preferred_service')
      .eq('id', user.value.id)
      .maybeSingle();
    profile.value = (data as Profile | null) ?? null;
  }

  async function setPreferredService(service: ServiceKey) {
    if (!user.value) return;
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_service: service })
      .eq('id', user.value.id);
    if (error) throw error;
    if (profile.value) profile.value = { ...profile.value, preferred_service: service };
  }

  async function setDisplayName(name: string) {
    if (!user.value) return;
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name })
      .eq('id', user.value.id);
    if (error) throw error;
    if (profile.value) profile.value = { ...profile.value, display_name: name };
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      user.value = data.session?.user ?? null;
      loading.value = false;
      if (user.value) await loadProfile();
      supabase.auth.onAuthStateChange((_evt, session) => {
        user.value = session?.user ?? null;
        if (user.value) loadProfile();
        else profile.value = null;
      });
    })();
    return initPromise;
  }

  async function signOut() {
    await supabase.auth.signOut();
    user.value = null;
    profile.value = null;
  }

  /** Convenience: defaults to spotify until the profile loads or for signed-out callers. */
  const preferredService = computed<ServiceKey>(
    () => profile.value?.preferred_service ?? 'spotify',
  );

  return {
    user,
    profile,
    preferredService,
    loading,
    init,
    loadProfile,
    setPreferredService,
    setDisplayName,
    signOut,
  };
});

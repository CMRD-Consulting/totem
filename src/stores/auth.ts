import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const loading = ref(true);
  let initPromise: Promise<void> | null = null;

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      user.value = data.session?.user ?? null;
      loading.value = false;
      supabase.auth.onAuthStateChange((_evt, session) => {
        user.value = session?.user ?? null;
      });
    })();
    return initPromise;
  }

  async function signOut() {
    await supabase.auth.signOut();
    user.value = null;
  }

  return { user, loading, init, signOut };
});

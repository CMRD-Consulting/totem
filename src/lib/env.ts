function required(name: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  supabaseUrl: required('VITE_SUPABASE_URL'),
  supabaseAnonKey: required('VITE_SUPABASE_ANON_KEY'),
};

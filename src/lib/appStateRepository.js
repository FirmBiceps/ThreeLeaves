import { supabase } from './supabaseClient';

const TABLE_NAME = 'app_state';
const PRIMARY_ROW_ID = 'main';

export async function loadAppState() {
  if (!supabase) {
    return { data: null, error: null };
  }

  const { data, error, status } = await supabase
    .from(TABLE_NAME)
    .select('payload')
    .eq('id', PRIMARY_ROW_ID)
    .maybeSingle();

  if (error && status !== 406) {
    return { data: null, error };
  }

  return { data: data?.payload ?? null, error: null };
}

export async function saveAppState(payload) {
  if (!supabase) {
    return { error: null };
  }

  const { error } = await supabase.from(TABLE_NAME).upsert(
    {
      id: PRIMARY_ROW_ID,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  return { error };
}

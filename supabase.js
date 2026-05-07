import { createAccountDataState } from './state.js';

const SUPABASE_CONFIG = window.SUPABASE_CONFIG || null;

const DEFAULT_MEALS = {
  breakfast: '',
  lunch: '',
  dinner: '',
  snacks: '',
};

let supabaseClient = null;

function toPlain(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function requireClient() {
  if (!supabaseClient) {
    throw new Error('Sync not configured.');
  }

  return supabaseClient;
}

function normalizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    appMetadata: toPlain(user.app_metadata ?? {}),
    userMetadata: toPlain(user.user_metadata ?? {}),
  };
}

function normalizeSession(session) {
  if (!session) return null;

  return {
    accessToken: session.access_token ?? null,
    refreshToken: session.refresh_token ?? null,
    expiresAt: session.expires_at ?? null,
    expiresIn: session.expires_in ?? null,
    tokenType: session.token_type ?? null,
    user: normalizeUser(session.user),
  };
}

function normalizeAuthResponse(data) {
  return {
    session: normalizeSession(data?.session ?? null),
    user: normalizeUser(data?.user ?? data?.session?.user ?? null),
  };
}

function normalizeProfile(row) {
  if (!row) return null;

  return {
    id: row.id,
    initialized: Boolean(row.initialized),
    createdAt: row.created_at ?? null,
  };
}

function normalizeEntryRow(row) {
  if (!row) return null;

  return {
    slept: row.slept ?? '',
    woke: row.woke ?? '',
    goal: row.goal ?? '',
    tasks: toPlain(row.tasks ?? [{ text: '', done: false }]),
    pinnedDone: toPlain(row.pinned_done ?? {}),
    meals: toPlain(row.meals ?? DEFAULT_MEALS),
    habits: toPlain(row.habits ?? {}),
    notes: row.notes ?? '',
    win: row.win ?? '',
    tmr: row.tmr ?? '',
  };
}

function toEntryRow(userId, dateStr, entry = {}) {
  return {
    user_id: userId,
    entry_date: dateStr,
    slept: entry.slept ?? '',
    woke: entry.woke ?? '',
    goal: entry.goal ?? '',
    tasks: toPlain(entry.tasks ?? [{ text: '', done: false }]),
    pinned_done: toPlain(entry.pinnedDone ?? {}),
    meals: toPlain(entry.meals ?? DEFAULT_MEALS),
    habits: toPlain(entry.habits ?? {}),
    notes: entry.notes ?? '',
    win: entry.win ?? '',
    tmr: entry.tmr ?? '',
  };
}

function remapEntryIds(entry = {}, habitIdMap = new Map(), pinnedTaskIdMap = new Map()) {
  const habits = {};
  for (const [oldId, value] of Object.entries(entry.habits ?? {})) {
    habits[habitIdMap.get(oldId) ?? oldId] = value;
  }

  const pinnedDone = {};
  for (const [oldId, value] of Object.entries(entry.pinnedDone ?? {})) {
    pinnedDone[pinnedTaskIdMap.get(oldId) ?? oldId] = value;
  }

  return {
    ...entry,
    habits,
    pinnedDone,
  };
}

async function requireUser() {
  const session = await getCurrentSession();

  if (!session?.user) {
    throw new Error('Auth session not active.');
  }

  return session.user;
}

export function initSupabase() {
  if (supabaseClient) return true;

  if (!SUPABASE_CONFIG?.url || !SUPABASE_CONFIG?.anonKey) return false;
  if (!window.supabase?.createClient) return false;

  supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  return true;
}

export function getSupabaseClient() {
  return supabaseClient;
}

export async function getCurrentSession() {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);

  return normalizeSession(data.session);
}

export async function signIn(email, password) {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) throw new Error(error.message);

  return normalizeAuthResponse(data);
}

export async function signUp(email, password, confirmPassword = password) {
  const client = requireClient();

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  if (password !== confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(error.message);

  if (data.session?.user) {
    await ensureProfile();
  }

  return normalizeAuthResponse(data);
}

export async function signOut() {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
  return true;
}

export async function sendPasswordReset(email) {
  const client = requireClient();
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) throw new Error(error.message);

  return true;
}

export async function changePassword(currentOrNewPassword, maybeNewPassword, maybeConfirmPassword) {
  const client = requireClient();
  const newPassword = maybeNewPassword ?? currentOrNewPassword;
  const confirmPassword = maybeConfirmPassword ?? newPassword;

  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }

  if (newPassword !== confirmPassword) {
    throw new Error('New passwords do not match.');
  }

  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);

  return normalizeUser(data.user);
}

export async function ensureProfile(profilePatch = {}) {
  const client = requireClient();
  const user = await requireUser();
  const row = {
    id: user.id,
  };

  if (Object.prototype.hasOwnProperty.call(profilePatch, 'initialized')) {
    row.initialized = Boolean(profilePatch.initialized);
  }

  const { data, error } = await client
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  return normalizeProfile(data);
}

export async function loadRemoteBootstrap() {
  const client = requireClient();
  const user = await requireUser();
  const bootstrap = createAccountDataState();

  const [profile, habitsRes, pinnedRes, entriesRes] = await Promise.all([
    ensureProfile(),
    client
      .from('habit_definitions')
      .select('id, icon, label, sort_order')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    client
      .from('pinned_tasks')
      .select('id, text, sort_order')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    client
      .from('daily_entries')
      .select('entry_date, slept, woke, goal, tasks, pinned_done, meals, habits, notes, win, tmr')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: true }),
  ]);

  if (habitsRes.error) throw new Error(habitsRes.error.message);
  if (pinnedRes.error) throw new Error(pinnedRes.error.message);
  if (entriesRes.error) throw new Error(entriesRes.error.message);

  const db = {};
  for (const row of entriesRes.data ?? []) {
    db[row.entry_date] = normalizeEntryRow(row);
  }

  return {
    ...bootstrap,
    habits: (habitsRes.data ?? []).map(row => ({
      id: row.id,
      icon: row.icon ?? '⭐',
      label: row.label ?? '',
    })),
    pinnedTasks: (pinnedRes.data ?? []).map(row => ({
      id: row.id,
      text: row.text ?? '',
    })),
    db,
    profile: profile ?? bootstrap.profile,
  };
}

export async function loadEntry(dateStr) {
  const client = requireClient();
  const user = await requireUser();
  const { data, error } = await client
    .from('daily_entries')
    .select('id, entry_date, slept, woke, goal, tasks, pinned_done, meals, habits, notes, win, tmr')
    .eq('user_id', user.id)
    .eq('entry_date', dateStr)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    date: data.entry_date,
    entry: normalizeEntryRow(data),
  };
}

export async function upsertEntry(dateStr, entry) {
  const client = requireClient();
  const user = await requireUser();
  const { data, error } = await client
    .from('daily_entries')
    .upsert(toEntryRow(user.id, dateStr, entry), { onConflict: 'user_id,entry_date' })
    .select('id, entry_date, slept, woke, goal, tasks, pinned_done, meals, habits, notes, win, tmr')
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    date: data.entry_date,
    entry: normalizeEntryRow(data),
  };
}

export async function replaceAllUserDataFromLocal(localState) {
  const client = requireClient();
  const user = await requireUser();
  const habitIdMap = new Map();
  const pinnedTaskIdMap = new Map();

  await deleteAllUserData();
  await ensureProfile({ initialized: true });

  const habits = (localState?.habits ?? []).map((habit, index) => ({
    user_id: user.id,
    icon: habit.icon ?? '⭐',
    label: habit.label ?? '',
    sort_order: index,
  }));

  if (habits.length) {
    const { data, error } = await client
      .from('habit_definitions')
      .insert(habits)
      .select('id, sort_order');
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const localHabit = localState?.habits?.[row.sort_order];
      if (localHabit?.id) {
        habitIdMap.set(localHabit.id, row.id);
      }
    }
  }

  const pinnedTasks = (localState?.pinnedTasks ?? []).map((task, index) => ({
    user_id: user.id,
    text: task.text ?? '',
    sort_order: index,
  }));

  if (pinnedTasks.length) {
    const { data, error } = await client
      .from('pinned_tasks')
      .insert(pinnedTasks)
      .select('id, sort_order');
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const localTask = localState?.pinnedTasks?.[row.sort_order];
      if (localTask?.id) {
        pinnedTaskIdMap.set(localTask.id, row.id);
      }
    }
  }

  const entries = Object.entries(localState?.db ?? {}).map(([dateStr, entry]) =>
    toEntryRow(user.id, dateStr, remapEntryIds(entry, habitIdMap, pinnedTaskIdMap))
  );

  if (entries.length) {
    const { error } = await client.from('daily_entries').insert(entries);
    if (error) throw new Error(error.message);
  }

  return loadRemoteBootstrap();
}

export async function deleteAllUserData() {
  const client = requireClient();
  const user = await requireUser();

  const entriesRes = await client.from('daily_entries').delete().eq('user_id', user.id);
  if (entriesRes.error) throw new Error(entriesRes.error.message);

  const pinnedRes = await client.from('pinned_tasks').delete().eq('user_id', user.id);
  if (pinnedRes.error) throw new Error(pinnedRes.error.message);

  const habitsRes = await client.from('habit_definitions').delete().eq('user_id', user.id);
  if (habitsRes.error) throw new Error(habitsRes.error.message);

  const profileRes = await client.from('profiles').delete().eq('id', user.id);
  if (profileRes.error) throw new Error(profileRes.error.message);

  return true;
}

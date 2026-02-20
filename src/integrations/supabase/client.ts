import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Configuration pour le projet Supabase personnel
const SUPABASE_URL = "https://svtwaxnaghrjyogcljnp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_m9DQJsvGfzifNUr7aTDoNg_v53MrWJm";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

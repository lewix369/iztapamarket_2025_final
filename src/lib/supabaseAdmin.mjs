import { createClient } from "@supabase/supabase-js";

// Cliente con Service Role (para el backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabase;

import React, { createContext, useContext, useMemo } from 'react';
import { supabase as supabaseClient } from '@/lib/supabaseClient';

const SupabaseContext = createContext();

export const SupabaseProvider = ({ children }) => {
  const supabase = useMemo(() => supabaseClient, []);

  if (!supabase) {
    console.error("Supabase client instance is not available in SupabaseProvider. Check supabaseClient.js.");
    return (
      <div>
        <p style={{ color: 'red', padding: '20px', textAlign: 'center', fontSize: '1.2em' }}>
          Error crítico: La conexión con la base de datos no pudo ser establecida. Por favor, contacta al soporte.
        </p>
        {children}
      </div>
    );
  }

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  if (!context.supabase) {
    console.error("Supabase client is null within useSupabase hook. This indicates an initialization issue.");
  }
  return context;
};

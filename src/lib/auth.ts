import { supabase } from "@/lib/supabase";
import { AppUser } from "@/lib/types";

export function requireBrowserSupabase() {
  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  return supabase;
}

export async function signInWithEmail(email: string, password: string) {
  const client = requireBrowserSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new Error("Email o contrasena incorrectos.");
  }

  return data;
}

export async function signOut() {
  const client = requireBrowserSupabase();
  const { error } = await client.auth.signOut();

  if (error) {
    throw new Error(`No se pudo cerrar sesion: ${error.message}`);
  }
}

export async function getAuthSession() {
  const client = requireBrowserSupabase();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw new Error(`No se pudo leer la sesion: ${error.message}`);
  }

  return data.session;
}

export function assertActiveUser(user: AppUser) {
  if (!user.active) {
    throw new Error("Tu usuario esta inactivo. Contacta a un administrador.");
  }
}

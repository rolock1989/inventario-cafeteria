"use client";

import { AppUser } from "@/lib/types";
import { createContext, useContext } from "react";

const AppUserContext = createContext<AppUser | null>(null);

export function AppUserProvider({ children, user }: { children: React.ReactNode; user: AppUser }) {
  return <AppUserContext.Provider value={user}>{children}</AppUserContext.Provider>;
}

export function useAppUser() {
  const user = useContext(AppUserContext);

  if (!user) {
    throw new Error("El contexto del usuario no esta disponible.");
  }

  return user;
}

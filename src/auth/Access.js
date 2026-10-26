import { useAuth } from "./AuthContext";

// Which side of the product this login works on.
//   support   -> complaints only
//   developer -> projects, tasks and bugs only
//   both      -> everything (the admin account always has both)
export function useAccess() {
  const { user, isAdmin } = useAuth();
  const access = isAdmin ? "both" : user?.access || "developer";
  return {
    access,
    isSupport: access === "support",
    isDeveloper: access === "developer",
    isBoth: access === "both",
  };
}
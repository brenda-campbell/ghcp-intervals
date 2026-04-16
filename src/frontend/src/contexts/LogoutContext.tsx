import { createContext, useContext } from "react";

type LogoutFn = () => void;

const LogoutContext = createContext<LogoutFn>(() => {});

export const LogoutProvider = LogoutContext.Provider;
export function useLogout(): LogoutFn {
  return useContext(LogoutContext);
}

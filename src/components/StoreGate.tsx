import "../styles/fonts.css";
import { type ReactNode } from "react";
import { StoreProvider } from "../lib/store";
import "../styles/app-utilities.css";

export default function StoreGate({ children }: { children: ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}

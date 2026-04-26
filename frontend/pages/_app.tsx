import "@/styles/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { AppProps } from "next/app";
import { ClerkAuthGate } from "@/components/ClerkAuthGate";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider {...pageProps}>
      <ClerkAuthGate>
        <Component {...pageProps} />
      </ClerkAuthGate>
    </ClerkProvider>
  );
}

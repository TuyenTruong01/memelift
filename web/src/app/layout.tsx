import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "MemeLift — Fair launches on Arc",
  description: "Permissionless fixed-supply meme launches priced in USDC on Arc.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="shell">
            <Header />
            <main>{children}</main>
            <footer>
              Experimental software. Contracts are unaudited. Mainnet transactions use real USDC.
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}

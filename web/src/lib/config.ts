"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { arcMainnet, arcNetwork, arcTestnet } from "./arc";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

const connectors = walletConnectProjectId
  ? [
      injected({ shimDisconnect: true }),
      walletConnect({
        projectId: walletConnectProjectId,
        showQrModal: true,
        metadata: {
          name: "ArcMeme",
          description: "Permissionless USDC meme fair launches on Arc",
          url: typeof window !== "undefined" ? window.location.origin : "https://localhost",
          icons: [],
        },
      }),
    ]
  : [injected({ shimDisconnect: true })];

export const wagmiConfig = createConfig({
  // The selected network must be first: usePublicClient() defaults to it.
  chains: arcNetwork.id === arcTestnet.id
    ? [arcTestnet, arcMainnet]
    : [arcMainnet, arcTestnet],
  connectors,
  transports: {
    [arcMainnet.id]: http(arcMainnet.rpcUrls.default.http[0]),
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

export const queryClient = new QueryClient();

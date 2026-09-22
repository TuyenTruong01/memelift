"use client";

import { useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { arcNetwork } from "@/lib/arc";
import { shortAddress } from "@/lib/format";

export default function WalletButton() {
  const [open, setOpen] = useState(false);
  const [connectError, setConnectError] = useState("");
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  if (isConnected && chainId !== arcNetwork.id) {
    return (
      <button
        className="button button-primary"
        disabled={switching}
        onClick={() => switchChain({ chainId: arcNetwork.id })}
      >
        {switching ? "Switching…" : "Switch to Arc"}
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <button className="button" onClick={() => disconnect()} title="Disconnect wallet">
        {shortAddress(address)}
      </button>
    );
  }

  async function connectWallet(connector: (typeof connectors)[number]) {
    setConnectError("");
    try {
      await connectAsync({ connector, chainId: arcNetwork.id });
      setOpen(false);
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Could not connect the wallet.");
    }
  }

  const directConnector = connectors.length === 1 ? connectors[0] : undefined;

  return (
    <div className="wallet-wrap">
      <button
        className="button button-primary"
        disabled={isPending}
        onClick={() => directConnector ? connectWallet(directConnector) : setOpen((v) => !v)}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className="wallet-menu">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              disabled={isPending}
              onClick={() => connectWallet(connector)}
            >
              {connector.name}
            </button>
          ))}
          {connectors.length === 1 && (
            <small>
              Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable QR/mobile wallets.
            </small>
          )}
          {connectError && <small className="wallet-error">{connectError}</small>}
        </div>
      )}
      {!open && connectError && <div className="wallet-connect-error">{connectError}</div>}
    </div>
  );
}

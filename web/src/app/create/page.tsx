"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decodeEventLog, parseUnits, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { arcNetwork, ARC_EXPLORER } from "@/lib/arc";
import { factoryAbi } from "@/lib/abis";
import { FACTORY_ADDRESS, FACTORY_CONFIGURED } from "@/lib/contracts";
import { ipfsToHttp } from "@/lib/format";

function formatSupply(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("de-DE") : "";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "shortMessage" in error && typeof error.shortMessage === "string") {
    return error.shortMessage;
  }
  return fallback;
}

export default function CreatePage() {
  const router = useRouter();
  const publicClient = usePublicClient();
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("");
  const [imageURI, setImageURI] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageSelected, setImageSelected] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<Hex | "">("");

  async function createLaunch() {
    if (!FACTORY_CONFIGURED) return setError("Factory address is not configured.");
    if (!isConnected || !address) return setError("Connect a wallet first.");
    if (!publicClient) return setError("RPC client is not ready.");

    setBusy(true);
    setError("");
    setTxHash("");

    try {
      if (chainId !== arcNetwork.id) await switchChainAsync({ chainId: arcNetwork.id });

      const cleanName = name.trim();
      const cleanSymbol = symbol.trim().toUpperCase();
      if (!cleanName || cleanName.length > 32) throw new Error("Name must be 1–32 characters.");
      if (!cleanSymbol || cleanSymbol.length > 12) throw new Error("Symbol must be 1–12 characters.");
      if (imageSelected && (uploadingImage || imageUploadError || !imageURI)) {
        throw new Error("Wait for the selected image to finish uploading to IPFS.");
      }
      if (imageURI.length > 256) throw new Error("Image/metadata URI is too long.");

      const rawSupply = parseUnits(supply.replace(/\D/g, ""), 18);
      const min = parseUnits("1000000", 18);
      const max = parseUnits("1000000000000", 18);
      if (rawSupply < min || rawSupply > max) {
        throw new Error("Supply must be between 1,000,000 and 1,000,000,000,000 tokens.");
      }

      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "createLaunch",
        args: [cleanName, cleanSymbol, rawSupply, imageURI.trim()],
        chainId: arcNetwork.id,
      });
      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let launchAddress: Address | undefined;

      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === "LaunchCreated") {
            launchAddress = decoded.args.launch;
            break;
          }
        } catch {
          // Ignore unrelated logs from child contract creation.
        }
      }

      if (launchAddress) router.push(`/token/${launchAddress}`);
      else router.push("/");
    } catch (e) {
      setError(getErrorMessage(e, "Transaction failed."));
    } finally {
      setBusy(false);
    }
  }

  async function selectImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      return setError("Only PNG, JPG, and WebP images are supported.");
    }
    if (file.size > 2 * 1024 * 1024) return setError("Image must be no larger than 2 MB.");

    setError("");
    setImageSelected(true);
    setImageUploadError("");
    setImageURI("");
    setImagePreview("");
    setUploadingImage(true);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const payload = await response.json() as { cid?: string; uri?: string; error?: unknown };
      if (!response.ok || !payload.uri || !payload.cid) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Image upload failed. Please try again.");
      }

      setImageURI(payload.uri);
      setImagePreview(ipfsToHttp(payload.uri));
    } catch (uploadError) {
      const message = getErrorMessage(uploadError, "Image upload failed. Please try again.");
      setImageUploadError(message);
      setError(message);
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className="form-wrap">
      <div className="form-head">
        <div className="eyebrow">Permissionless creation</div>
        <h2>Create a fair launch</h2>
        <p>
          100% of the fixed supply is minted directly into the bonding curve. The creator receives
          no token allocation and there is no mint function.
        </p>
      </div>

      {!FACTORY_CONFIGURED && (
        <div className="notice error">Set NEXT_PUBLIC_FACTORY_ADDRESS before creating launches.</div>
      )}
      {error && <div className="notice error">{error}</div>}
      {txHash && (
        <div className="notice">
          Transaction submitted. <a className="address-link" href={`${ARC_EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">View on Arc Explorer</a>
        </div>
      )}

      <div className="form">
        <label className="field">
          <span>Token name</span>
          <input maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder="Meme Cat" />
        </label>
        <label className="field">
          <span>Symbol</span>
          <input maxLength={12} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="MCAT" />
        </label>
        <label className="field">
          <span>Fixed supply</span>
          <input className="supply-input" inputMode="numeric" value={formatSupply(supply)} onChange={(e) => setSupply(e.target.value.replace(/\D/g, ""))} placeholder="1,000,000,000" />
        </label>
        <div className="field">
          <span>Token image</span>
          <input ref={fileInputRef} className="file-input" type="file" accept="image/*" onChange={(e) => selectImage(e.target.files?.[0])} />
          <button type="button" className="image-dropzone" onClick={() => fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); selectImage(e.dataTransfer.files[0]); }}>
            {uploadingImage ? <><strong>Uploading to IPFS…</strong><span>Please keep this page open</span></> : imagePreview ? <img src={imagePreview} alt="Pinned token image preview" /> : <><strong>+ Upload image</strong><span>PNG, JPG, or WebP · max 2 MB</span></>}
          </button>
          {imageURI && <div className="help">Pinned to IPFS: {imageURI}</div>}
          {imageUploadError && <div className="help upload-error">{imageUploadError}</div>}
        </div>
        <details className="advanced-options">
          <summary>Advanced options</summary>
          <label className="field">
            <span>URL / IPFS</span>
            <input
              value={imageURI}
              onChange={(e) => {
                const uri = e.target.value;
                setImageURI(uri);
                if (!imageSelected) setImagePreview(ipfsToHttp(uri));
              }}
              placeholder="ipfs://... or https://..."
            />
          </label>
        </details>

        <button className="button button-primary" disabled={busy || uploadingImage || (imageSelected && !imageURI) || !FACTORY_CONFIGURED} onClick={createLaunch}>
          {uploadingImage ? "Uploading image…" : busy ? "Creating on Arc…" : isConnected ? "Create launch" : "Connect wallet, then create"}
        </button>
      </div>
    </div>
  );
}

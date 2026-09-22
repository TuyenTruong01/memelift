import Image from "next/image";
import Link from "next/link";
import { ARC_EXPLORER } from "@/lib/arc";
import WalletButton from "./WalletButton";

export default function Header() {
  return (
    <header className="header">
      <Link href="/" className="brand">
        <Image
          className="brand-logo"
          src="/images/memelift-logo.png"
          alt="MemeLift"
          width={36}
          height={36}
          priority
        />
        <span>MemeLift</span>
      </Link>
      <nav className="main-nav" aria-label="Primary navigation">
        <a href={ARC_EXPLORER} target="_blank" rel="noreferrer">Explore</a>
        <Link href="/create">Create</Link>
      </nav>
      <div className="header-actions">
        <span className="network-badge">Arc Mainnet</span>
        <WalletButton />
      </div>
    </header>
  );
}

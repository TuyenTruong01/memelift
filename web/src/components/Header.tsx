import Image from "next/image";
import Link from "next/link";
import WalletButton from "./WalletButton";
import { arcNetwork } from "@/lib/arc";

export default function Header() {
  return (
    <header className="header">
      <Link href="/" className="brand">
        <Image
          className="brand-logo"
          src="/images/arcmeme-logo.png"
          alt="MemeLift"
          width={36}
          height={36}
          priority
        />
        <span>MemeLift</span>
      </Link>
      <nav>
        <Link href="/">Explore</Link>
        <Link href="/create">Create</Link>
        <span className="network-badge">{arcNetwork.name}</span>
        <WalletButton />
      </nav>
    </header>
  );
}

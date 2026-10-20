import { Link } from "react-router-dom";
import "./hunting-rewards.css";

export function HuntingRewards({ amount }: { amount: number }) {
  return (
    <Link to="/chest" className="hunting-rewards-chip" aria-label="Hunting rewards">
      <span className="icon-coin" aria-hidden />
      <span className="hunting-rewards-copy">
        <small>HUNTING REWARDS</small>
        <strong>{amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span> MHDG</span></strong>
      </span>
    </Link>
  );
}

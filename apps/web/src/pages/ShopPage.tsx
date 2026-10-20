import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { RecoveryHouse } from "../components/RecoveryHouse";
import { useAuth } from "../state/AuthContext";

export function ShopPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [hasSmith, setHasSmith] = useState(false);

  useEffect(() => {
    if (!token) return;
    void api
      .world(token)
      .then((world) => setHasSmith(Boolean(world.serviceName)))
      .catch(() => setHasSmith(false));
  }, [token]);

  return (
    <section className="page" aria-label="SHOP">
      <nav className="page-modes" aria-label="Shop">
        <button
          type="button"
          className="mode mode-summon"
          onClick={() => navigate("/shop/summon")}
        >
          <span className="mode-card">
            <span className="mode-art art-summon">
              <img className="art-summon-image" src="/shop/summon-cards.png" alt="" />
              <span className="art-gloss" />
            </span>
            <span className="mode-name">SUMMON</span><span className="shop-description">Find your next adventurer</span>
          </span>
        </button>

        <button
          type="button"
          className="mode mode-blacksmiths"
          onClick={() => navigate("/shop/blacksmiths")}
        >
          <span className="mode-card">
            <span className="mode-art art-forge">
              <RecoveryHouse tier={1} active={hasSmith} />
            </span>
            <span className="mode-name">HOUSES</span><span className="shop-description">A home for tired heroes</span>
          </span>
        </button>

        <button
          type="button"
          className={`mode mode-porter${hasSmith ? "" : " disabled"}`}
          disabled={!hasSmith}
          onClick={() => navigate("/shop/porter")}
        >
          <span className="mode-card">
            <span className="mode-art art-porter">
              <span className="porter-loop" />
              {!hasSmith && (
                <span className="mode-lock">
                  <span className="mode-lock-text">NEEDS A HOUSE</span>
                </span>
              )}
            </span>
            <span className="mode-name">PORTER</span><span className="shop-description">Keep the adventure moving</span>
          </span>
        </button>
      </nav>
    </section>
  );
}

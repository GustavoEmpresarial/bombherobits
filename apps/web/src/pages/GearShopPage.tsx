import { PageHeading } from "../components/Page";
import { useAuth } from "../state/AuthContext";
import { EquipmentPanel } from "./EquipmentPanel";

export function GearShopPage() {
  const { token, user, setUser } = useAuth();
  if (!token) return null;
  return <section className="page gear-shop-page" aria-label="GEAR SHOP">
    <PageHeading eyebrow="SHOP · GEAR" title="Open a gear box." description="Choose a box, check its odds and guarantees, then equip your finds in the armory." />
    <EquipmentPanel token={token} user={user} setUser={setUser} shopOnly />
  </section>;
}

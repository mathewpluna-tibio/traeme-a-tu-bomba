import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useSesionUnica } from "./hooks/useSesionUnica";
import WelcomeModal from "./modules/ingreso/WelcomeModal";
import MenuPrincipal from "./modules/menu/MenuPrincipal";
import PerfilPage from "./modules/perfil/PerfilPage";
import RankingsPage from "./modules/rankings/RankingsPage";
import MisionesPage from "./modules/misiones/MisionesPage";

function App() {
  const { user, loading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);
  const [vista, setVista] = useState("jugar"); // "jugar" | "perfil" | "rankings" | "misiones"

  useSesionUnica();

  if (loading) return <p>Cargando...</p>;

  const volverAlMenu = () => setVista("jugar");

  return (
    <>
      {!user && showWelcome && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}

      {user && (
        <>
          {vista === "jugar" && (
            <MenuPrincipal
              onIrAPerfil={() => setVista("perfil")}
              onIrARankings={() => setVista("rankings")}
              onIrAMisiones={() => setVista("misiones")}
            />
          )}
          {vista === "perfil" && <PerfilPage onVolver={volverAlMenu} />}
          {vista === "rankings" && <RankingsPage onVolver={volverAlMenu} />}
          {vista === "misiones" && <MisionesPage onVolver={volverAlMenu} />}
        </>
      )}
    </>
  );
}

export default App;
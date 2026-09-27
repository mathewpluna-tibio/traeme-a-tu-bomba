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
  const [vista, setVista] = useState("jugar"); // "jugar" | "perfil" | "rankings"

  useSesionUnica();

  if (loading) return <p>Cargando...</p>;

  return (
    <>
      {/* RQF-ING-01: sin sesión (ni siquiera invitado), no hay forma de llegar
          a los botones de juego — WelcomeModal ya no se puede cerrar sin
          autenticarse, solo desaparece cuando `user` deja de ser null. */}
      {!user && <WelcomeModal />}

      {user && (
        <>
          {vista === "jugar" && <MenuPrincipal />}
          {vista === "perfil" && <PerfilPage />}
          {vista === "rankings" && <RankingsPage />}
        </>
      )}
    </>
  );
}

export default App;
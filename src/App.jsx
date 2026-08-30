import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useSesionUnica } from "./hooks/useSesionUnica";
import WelcomeModal from "./modules/ingreso/WelcomeModal";
import PerfilPage from "./modules/perfil/PerfilPage";
import MenuPrincipal from "./modules/menu/MenuPrincipal";

function App() {
  const { user, loading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);

  useSesionUnica();

  if (loading) return <p>Cargando...</p>;

  return (
    <>
      {!user && showWelcome && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}
      {user && <MenuPrincipal />}
    </>
  );
}

export default App;
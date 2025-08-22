import { useSession } from "@/contexts/SessionContext";

const DebugUser = () => {
  const { user, loading } = useSession();

  if (loading) return <p>Cargando sesión...</p>;

  if (!user) return <p>No hay sesión activa</p>;

  return (
    <div>
      <p>
        <strong>Usuario activo:</strong> {user.email}
      </p>
      <p>
        <strong>ID:</strong> {user.id}
      </p>
    </div>
  );
};

export default DebugUser;

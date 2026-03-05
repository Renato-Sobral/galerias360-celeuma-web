"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

/**
 * Componente de proteção de rota baseado em roles.
 * @param {JSX.Element | Function} children - Elemento ou função que recebe `userRole`.
 * @param {string[]} rolesRequired - Lista de roles permitidas para a rota.
 */
const ProtectedRoute = ({ children, rolesRequired }) => {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  const requiredRoles = Array.isArray(rolesRequired)
    ? rolesRequired
    : rolesRequired
      ? [rolesRequired]
      : [];

  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem("authToken");

      if (!token) {
        console.warn("Token não encontrado. Redirecionando para login...");
        router.push("/login");
        return;
      }

      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("Resposta do /auth/me:", response.data);

        const { role, roles } = response.data.user || {};

        // Normaliza para array de roles
        const userRoles = Array.isArray(roles)
          ? roles
          : role
            ? [role]
            : [];

        console.log("Roles do utilizador:", userRoles);
        console.log("Roles permitidas:", requiredRoles);

        // Se não houver roles exigidas, basta o token ser válido
        if (requiredRoles.length === 0) {
          setUserRole(userRoles[0] ?? null);
          setIsAuthorized(true);
          return;
        }

        const authorized = userRoles.some((r) =>
          requiredRoles.includes(r)
        );

        if (authorized) {
          setUserRole(userRoles[0]); // Se quiseres passar a role para o componente filho
          setIsAuthorized(true);
        } else {
          console.warn("Utilizador não autorizado. Redirecionando...");
          // Não remover token: é um caso de "forbidden", não "unauthenticated"
          router.push("/map");
        }
      } catch (error) {
        console.error("Erro ao verificar autorização:", error);
        localStorage.removeItem("authToken");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [router, rolesRequired]);

  if (loading || !isAuthorized) return null;

  return typeof children === "function" ? children(userRole) : children;
};

export default ProtectedRoute;

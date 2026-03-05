"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { getUserIdFromToken } from "../components/jwtDecode";
import { Button } from "@/components/ui/button";
import Swal from "sweetalert2";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

const AccountDetails = () => {
  const [id, setId] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetSuccess, setResetSuccess] = useState(null);

  useEffect(() => {
    const userId = getUserIdFromToken();
    setId(userId);

    if (!userId) {
      setError("Utilizador não autenticado.");
      setLoading(false);
      return;
    }

    const fetchUserDetails = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) {
          throw new Error("Utilizador não autenticado");
        }

        const response = await fetch(`${apiUrl}/user/details/${userId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Erro ao buscar os detalhes do Utilizador");
        }

        const data = await response.json();
        setUser(data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  const handleReporPassword = async () => {
    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Utilizador não autenticado");
      }

      await axios.post(
        `${apiUrl}/password/recuperarPassword`,
        { email: user.email },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setResetSuccess("Pedido de reposição de password enviado com sucesso.");

      await Swal.fire({
        title: "Email enviado!",
        text: "Foi enviado um email com instruções para repor a palavra-passe.",
        icon: "success",
        confirmButtonColor: "#171717",
      });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Erro ao repor password.";
      setResetError(message);

      await Swal.fire({
        title: "Erro",
        text: message,
        icon: "error",
        confirmButtonColor: "#171717",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex-1 p-8 overflow-auto">
        {loading ? (
          <p className="text-gray-500">Carregando...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : user ? (
          <div className="flow-root">
            <dl className="-my-3 divide-y divide-gray-100 text-sm">
              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-gray-900">Nome</dt>
                <dd className="text-gray-700 sm:col-span-2">{user.name}</dd>
              </div>

              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-gray-900">E-mail</dt>
                <dd className="text-gray-700 sm:col-span-2">{user.email}</dd>
              </div>
            </dl>

            <div className="mt-6">
              <Button
                onClick={handleReporPassword}
                disabled={resetLoading}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {resetLoading ? "A enviar..." : "Repor Palavra-Passe"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Utilizador não encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default AccountDetails;

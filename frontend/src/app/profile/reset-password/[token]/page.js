"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import axios from "axios";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export default function ResetPassword() {
  const { token } = useParams();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newPassword || !confirmPassword) {
      setError("Por favor preencha ambos os campos.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As passwords não coincidem.");
      return;
    }

    if (newPassword.length < 6) {
      setError("A password deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!token) {
      setError("Token inválido ou inexistente.");
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${apiUrl}/password/redefinirPassword`, {
        resetToken: token,
        newPassword,
      });

      setSuccess("Password alterada com sucesso.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Erro ao alterar a password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-semibold mb-6">Repor Palavra-Passe</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="newPassword" className="block text-gray-700 font-medium mb-1">
            Nova Password
          </label>
          <input
            type="password"
            id="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
            minLength={6}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="confirmPassword" className="block text-gray-700 font-medium mb-1">
            Confirmar Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
            minLength={6}
          />
        </div>

        {error && <p className="mb-4 text-red-600">{error}</p>}
        {success && <p className="mb-4 text-green-600">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "A processar..." : "Alterar Password"}
        </button>
      </form>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import axios from "axios";
import { useParams } from "next/navigation";
import Logo from "../../components/logo";

const RegisterForm = ({ token }) => {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !password || !confirmPassword) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axios.post(`${apiUrl}/convite/registo`, {
        name,
        password,
        token,
      });

      alert("Conta criada com sucesso!");
      setName("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8 text-gray-900 dark:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="flex justify-center items-center">
          <Logo width={170} height={100} />
        </div>
        <h2 className="mt-10 text-2xl leading-9 font-bold tracking-tight">
          Criar Conta
        </h2>
      </div>

      <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium leading-6">
              Nome
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-2 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-black px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium leading-6">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="mt-2 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-black px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium leading-6">
              Confirmar Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="mt-2 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-black px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`mt-5 flex w-full justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm ${
                loading ? "opacity-50 cursor-not-allowed" : "hover:bg-red-500"
              }`}
            >
              {loading ? "A criar conta..." : "Criar Conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function RegisterWithTokenPage() {
  const params = useParams();
  const token = params.token;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted dark:bg-black px-4 py-6">
      <div className="w-full max-w-sm">
        <RegisterForm token={token} />
      </div>
    </div>
  );
}

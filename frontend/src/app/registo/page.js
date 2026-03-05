'use client'

import React, { useState } from "react";
import axios from "axios";
import Logo from "../components/logo";
import Link from 'next/link';

const RegisterForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
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
      await axios.post(`${apiUrl}/auth/registo`, { name, email, password });

      alert("Registo realizado com sucesso!");

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response ? err.response.data.message : "Erro no registo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8 text-gray-900 dark:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="flex justify-center items-center">
          <Link href="/">
            <Logo width={170} height={100} />
          </Link>
        </div>
        <h2 className="mt-10 text-2xl leading-9 font-bold tracking-tight">
          Criar conta
        </h2>
      </div>

      <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm leading-6 font-medium text-gray-900 dark:text-white">
              Nome
            </label>
            <div className="mt-2">
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-black px-3 py-1.5 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm leading-6 font-medium text-gray-900 dark:text-white">
              Email
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-black px-3 py-1.5 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm leading-6 font-medium text-gray-900 dark:text-white">
              Password
            </label>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-black px-3 py-1.5 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm leading-6 font-medium text-gray-900 dark:text-white">
              Confirmar Password
            </label>
            <div className="mt-2">
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-black px-3 py-1.5 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm leading-6"
              />
            </div>
          </div>

          {error && <div className="text-red-600 text-sm leading-6">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`mt-5 flex w-full justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm leading-6 font-semibold text-white shadow-xs 
                ${loading ? "opacity-50 cursor-not-allowed" : "hover:bg-red-500"}`}
            >
              {loading ? "Aguarde..." : "Criar Conta"}
            </button>
          </div>

          <p className="mt-5 text-sm leading-6 text-gray-500 dark:text-gray-300">
            Já tem conta?{" "}
            <a href="/login" className="font-semibold text-red-600 hover:text-red-500">
              Iniciar sessão
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted dark:bg-black p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <RegisterForm />
      </div>
    </div>
  );
}

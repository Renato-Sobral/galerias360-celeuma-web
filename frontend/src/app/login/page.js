'use client'

import React, { useState } from "react";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import Logo from "../components/logo";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, { email, password });

      if (response.data.authToken) {
        localStorage.setItem('authToken', response.data.authToken);
        router.replace('/map');
      }
    } catch (err) {
      if (!err.response) {
        setError('Não foi possível ligar ao servidor. Verifica se a API está ativa.');
        return;
      }

      setError(err.response?.data?.message || 'Email ou senha inválidos.');
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col px-8 py-12 lg:px-5 text-gray-900 dark:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="flex justify-center items-center">
          <Link href="/">
            <Logo width={170} height={100} />
          </Link>
        </div>
        <h2 className="mt-10 text-2xl/9 font-bold tracking-tight">
          Entrar
        </h2>
        <p className="mt-5 text-sm/6 text-gray-500 dark:text-gray-300">
          Ainda não está registado?{' '}
          <a href="/registo" className="font-semibold text-primary hover:text-primary/80">
            Criar conta
          </a>
        </p>
      </div>

      <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="block text-sm/6 font-medium text-gray-900 dark:text-white">
              Email
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="block w-full rounded-md border border-input bg-background px-3 py-1.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-2 focus:-outline-offset-2 focus:outline-ring sm:text-sm/6"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                Password
              </label>
              <div className="text-sm">
                <a href="#" className="font-semibold text-primary hover:text-primary/80">
                  Esqueceu-se da password?
                </a>
              </div>
            </div>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="block w-full rounded-md border border-input bg-background px-3 py-1.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-2 focus:-outline-offset-2 focus:outline-ring sm:text-sm/6"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="text-destructive text-sm">{error}</div>}

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-md bg-primary px-3 py-1.5 text-sm/6 font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted dark:bg-black p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LoginForm />
      </div>
    </div>
  );
}

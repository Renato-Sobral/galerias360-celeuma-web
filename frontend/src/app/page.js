'use client';

import { useEffect, useState } from "react";
import { Dialog, DialogPanel } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import Logo from "./components/logo.js";

const navigation = []; // removidos os links 'Início' e 'Sobre'
const API = process.env.NEXT_PUBLIC_API_URL;

const DEFAULT_HERO_TITLE = "Explora o mundo com Galerias 360";
const DEFAULT_HERO_DESCRIPTION = "Descobre pontos turísticos e culturais em realidade aumentada com uma experiência imersiva em 360º. Acede ao mapa interativo e mergulha em cada história.";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroTitle, setHeroTitle] = useState(DEFAULT_HERO_TITLE);
  const [heroDescription, setHeroDescription] = useState(DEFAULT_HERO_DESCRIPTION);

  useEffect(() => {
    let mounted = true;

    const loadLandingContent = async () => {
      try {
        const res = await fetch(`${API}/theme/landing-content`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted || !json?.success) return;

        setHeroTitle(json.data?.title || DEFAULT_HERO_TITLE);
        setHeroDescription(json.data?.description || DEFAULT_HERO_DESCRIPTION);
      } catch {
        // fallback defaults already in state
      }
    };

    loadLandingContent();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="py-24 bg-white text-gray-900 dark:bg-black dark:text-white">
      <header className="absolute inset-x-0 top-0 z-50">
        <nav aria-label="Global" className="flex items-center justify-between p-4 sm:p-0 lg:px-8">
          <div className="flex lg:flex-1">
            <a href="#" className="-m-1.5 p-1.5">
              <span className="sr-only">Galerias 360</span>
              <Logo width={120} height={100} />
            </a>
          </div>
          <div className="flex lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700 dark:text-white"
            >
              <span className="sr-only">Abrir menu</span>
              <Bars3Icon aria-hidden="true" className="size-6" />
            </button>
          </div>
          {/* Este div fica vazio porque não há itens para mostrar */}
          <div className="hidden lg:flex lg:gap-x-12">
            {/* Sem links aqui */}
          </div>
          <div className="hidden lg:flex lg:flex-1 lg:justify-end">
            <Link href="/login" className="text-sm font-semibold text-gray-900 dark:text-white">
              Entrar <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </nav>

        <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
          <div className="fixed inset-0 z-50" />
          <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white dark:bg-zinc-900 px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
            <div className="flex items-center justify-between">
              <a href="#" className="-m-1.5 p-1.5">
                <span className="sr-only">Galerias 360</span>
                <Logo width={120} height={100} />
              </a>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="-m-2.5 rounded-md p-2.5 text-gray-700 dark:text-white"
              >
                <span className="sr-only">Fechar menu</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-500/10 dark:divide-gray-700">
                {/* Sem links de navegação */}
                <div className="space-y-2 py-6"></div>
                <div className="py-6">
                  <Link
                    href="/login"
                    className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800"
                  >
                    Entrar
                  </Link>
                </div>
              </div>
            </div>
          </DialogPanel>
        </Dialog>
      </header>

      <div aria-hidden="true" className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" />

      <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
        <div className="text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-7xl">
            {heroTitle}
          </h1>
          <p className="mt-8 max-w-3xl mx-auto text-lg font-medium text-gray-500 dark:text-gray-300 sm:text-xl leading-8 whitespace-pre-line break-words [overflow-wrap:anywhere]">
            {heroDescription}
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/map"
              className="rounded-md bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Ver Mapa
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

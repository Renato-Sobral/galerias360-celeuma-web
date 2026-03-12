'use client'

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import Logo from '../../components/logo';

export default function ConfirmarContaPage() {
    const { token } = useParams();
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('A confirmar a sua conta...');

    useEffect(() => {
        const confirmarConta = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Link de confirmação inválido.');
                return;
            }

            try {
                const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/auth/confirm-email`, {
                    params: { token },
                });

                setStatus('success');
                setMessage(response.data?.message || 'Conta confirmada com sucesso.');
            } catch (error) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'Não foi possível confirmar a conta.');
            }
        };

        confirmarConta();
    }, [token]);

    const messageColor = status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-gray-600';

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted dark:bg-black p-6 md:p-10">
            <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl bg-white p-8 shadow-sm dark:bg-zinc-950">
                <div className="flex justify-center items-center">
                    <Link href="/">
                        <Logo width={170} height={100} />
                    </Link>
                </div>

                <div className="space-y-3 text-center">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Confirmação de Conta</h1>
                    <p className={`text-sm leading-6 ${messageColor}`}>{message}</p>
                </div>

                <div className="flex justify-center">
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                        Ir para login
                    </Link>
                </div>
            </div>
        </div>
    );
}
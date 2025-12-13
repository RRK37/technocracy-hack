'use client';

import { useState } from 'react';
import { ArrowLeft, Building2, ArrowRight, Loader2 } from 'lucide-react';

interface CompanyInputPageProps {
    onSubmit: (company: string, agentIds: number[]) => void;
    onBack: () => void;
}

export function CompanyInputPage({ onSubmit, onBack }: CompanyInputPageProps) {
    const [company, setCompany] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:8000/api/context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'pitch', context: company.trim() }),
            });

            if (!response.ok) {
                throw new Error('Failed to set context');
            }

            const agentIds = await response.json();
            onSubmit(company.trim(), agentIds);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-8">
            {/* Back button */}
            <button
                onClick={onBack}
                className="absolute top-8 left-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
            </button>

            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex p-4 bg-red-500/20 rounded-full mb-4">
                    <Building2 className="w-10 h-10 text-red-400" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">
                    Who are you pitching to?
                </h1>
                <p className="text-gray-400 max-w-md">
                    Enter the company name you want to pitch your idea to
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full max-w-md">
                <div className="relative">
                    <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="e.g. Acme Corporation"
                        className="w-full px-6 py-4 bg-gray-800/50 border border-gray-700 rounded-2xl text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                        disabled={isLoading}
                        autoFocus
                    />
                </div>

                {error && (
                    <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={!company.trim() || isLoading}
                    className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-2xl text-white font-semibold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Setting up...
                        </>
                    ) : (
                        <>
                            Next
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>

            {/* Progress indicator */}
            <div className="mt-8 flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-gray-600" />
            </div>
        </div>
    );
}

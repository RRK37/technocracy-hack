'use client';

import { useState } from 'react';
import { ArrowLeft, User, Lightbulb, Rocket, Loader2 } from 'lucide-react';

interface UserContextPageProps {
    company: string;
    onSubmit: (userId: number) => void;
    onBack: () => void;
}

export function UserContextPage({ company, onSubmit, onBack }: UserContextPageProps) {
    const [pitchIdea, setPitchIdea] = useState('');
    const [aboutYou, setAboutYou] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pitchIdea.trim() || !aboutYou.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            // Combine pitch idea and about you into user_context
            const userContext = `Pitch Idea: ${pitchIdea.trim()}\n\nAbout Me: ${aboutYou.trim()}`;

            const response = await fetch('http://localhost:8000/api/user_context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_context: userContext }),
            });

            if (!response.ok) {
                throw new Error('Failed to set user context');
            }

            const userId = await response.json();
            onSubmit(userId);
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
                    <User className="w-10 h-10 text-red-400" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">
                    Tell us about your pitch
                </h1>
                <p className="text-gray-400 max-w-md">
                    Pitching to <span className="text-red-400 font-semibold">{company}</span>
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-6">
                {/* Pitch Idea */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                        <Lightbulb className="w-4 h-4 text-yellow-400" />
                        Your Business/Idea
                    </label>
                    <textarea
                        value={pitchIdea}
                        onChange={(e) => setPitchIdea(e.target.value)}
                        placeholder="Describe your business idea or what you want to pitch..."
                        rows={4}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                        disabled={isLoading}
                    />
                </div>

                {/* About You */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                        <User className="w-4 h-4 text-blue-400" />
                        About You
                    </label>
                    <textarea
                        value={aboutYou}
                        onChange={(e) => setAboutYou(e.target.value)}
                        placeholder="Tell us a bit about yourself and your background..."
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                        disabled={isLoading}
                    />
                </div>

                {error && (
                    <p className="text-red-400 text-sm text-center">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={!pitchIdea.trim() || !aboutYou.trim() || isLoading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-2xl text-white font-semibold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Preparing pitch...
                        </>
                    ) : (
                        <>
                            <Rocket className="w-5 h-5" />
                            Start Pitch
                        </>
                    )}
                </button>
            </form>

            {/* Progress indicator */}
            <div className="mt-8 flex gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-600" />
                <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
        </div>
    );
}

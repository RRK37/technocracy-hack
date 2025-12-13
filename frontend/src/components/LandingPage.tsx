'use client';

import { WorldMode } from '@/src/lib/world';
import { Eye, Zap, Rocket } from 'lucide-react';

interface LandingPageProps {
    onSelectMode: (mode: WorldMode) => void;
}

const modeOptions = [
    {
        mode: WorldMode.OBSERVE,
        title: 'Observe',
        description: 'Watch characters wander and interact naturally',
        icon: Eye,
        color: 'from-blue-500 to-blue-700',
        hoverColor: 'hover:from-blue-400 hover:to-blue-600',
    },
    {
        mode: WorldMode.INTERACTIVE,
        title: 'Interactive',
        description: 'Full dynamics with trap circles and character interactions',
        icon: Zap,
        color: 'from-purple-500 to-purple-700',
        hoverColor: 'hover:from-purple-400 hover:to-purple-600',
    },
    {
        mode: WorldMode.PITCH,
        title: 'Pitch',
        description: 'Combined presentation and discussion for pitching',
        icon: Rocket,
        color: 'from-red-500 to-red-700',
        hoverColor: 'hover:from-red-400 hover:to-red-600',
    },
];

export function LandingPage({ onSelectMode }: LandingPageProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-8">
            {/* Header */}
            <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
                    Technocracy
                </h1>
                <p className="text-xl text-gray-400 max-w-md">
                    Choose your experience mode
                </p>
            </div>

            {/* Mode Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
                {modeOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                        <button
                            key={option.mode}
                            onClick={() => onSelectMode(option.mode)}
                            className={`
                group relative overflow-hidden rounded-2xl p-6 
                bg-gradient-to-br ${option.color} ${option.hoverColor}
                transform transition-all duration-300 
                hover:scale-105 hover:shadow-2xl hover:shadow-${option.color.split('-')[1]}-500/30
                focus:outline-none focus:ring-4 focus:ring-white/20
              `}
                        >
                            {/* Decorative glow */}
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* Content */}
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="p-4 bg-white/20 rounded-full mb-4 group-hover:bg-white/30 transition-colors">
                                    <Icon className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    {option.title}
                                </h2>
                                <p className="text-white/80 text-sm">
                                    {option.description}
                                </p>
                            </div>

                            {/* Arrow indicator */}
                            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Footer hint */}
            <p className="mt-12 text-gray-500 text-sm">
                Click on a mode to begin
            </p>
        </div>
    );
}

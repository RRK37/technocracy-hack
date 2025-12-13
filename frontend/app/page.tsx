'use client';

import { useState } from 'react';
import { CharacterWorld } from "@/src/components/CharacterWorld";
import { LandingPage } from "@/src/components/LandingPage";
import { WorldMode } from "@/src/lib/world";

// Step-based state machine for app navigation
type AppStep =
  | { step: 'landing' }
  | { step: 'context'; mode: WorldMode }  // Future: company input for Pitch mode
  | { step: 'world'; mode: WorldMode; context?: Record<string, unknown> };

export default function Home() {
  const [appState, setAppState] = useState<AppStep>({ step: 'landing' });

  const handleSelectMode = (mode: WorldMode) => {
    // For now, go directly to world. Later, Pitch can go through context step
    // if (mode === WorldMode.PITCH) {
    //   setAppState({ step: 'context', mode });
    // } else {
    //   setAppState({ step: 'world', mode });
    // }
    setAppState({ step: 'world', mode });
  };

  const handleBack = () => {
    setAppState({ step: 'landing' });
  };

  // Render based on current step
  switch (appState.step) {
    case 'landing':
      return <LandingPage onSelectMode={handleSelectMode} />;

    case 'context':
      // Future: Context input page for Pitch mode
      // return <ContextPage mode={appState.mode} onSubmit={(ctx) => setAppState({ step: 'world', mode: appState.mode, context: ctx })} />
      return null;

    case 'world':
      return <CharacterWorld initialMode={appState.mode} onBack={handleBack} />;

    default:
      return <LandingPage onSelectMode={handleSelectMode} />;
  }
}

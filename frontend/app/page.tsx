'use client';

import { useState } from 'react';
import { CharacterWorld } from "@/src/components/CharacterWorld";
import { LandingPage } from "@/src/components/LandingPage";
import { CompanyInputPage } from "@/src/components/CompanyInputPage";
import { UserContextPage } from "@/src/components/UserContextPage";
import { WorldMode } from "@/src/lib/world";

// Context data stored after API calls
interface PitchContext {
  company: string;
  agentIds: number[];
  userId: number;
}

// Step-based state machine for app navigation
type AppStep =
  | { step: 'landing' }
  | { step: 'companyContext' }  // Pitch: company input
  | { step: 'userContext'; company: string; agentIds: number[] }  // Pitch: user input
  | { step: 'world'; mode: WorldMode; pitchContext?: PitchContext };

export default function Home() {
  const [appState, setAppState] = useState<AppStep>({ step: 'landing' });

  const handleSelectMode = (mode: WorldMode) => {
    if (mode === WorldMode.PITCH) {
      // Pitch mode goes through context pages
      setAppState({ step: 'companyContext' });
    } else {
      // Other modes go directly to world
      setAppState({ step: 'world', mode });
    }
  };

  const handleBack = () => {
    setAppState({ step: 'landing' });
  };

  // Render based on current step
  switch (appState.step) {
    case 'landing':
      return <LandingPage onSelectMode={handleSelectMode} />;

    case 'companyContext':
      return (
        <CompanyInputPage
          onSubmit={(company, agentIds) => {
            setAppState({ step: 'userContext', company, agentIds });
          }}
          onBack={handleBack}
        />
      );

    case 'userContext':
      return (
        <UserContextPage
          company={appState.company}
          onSubmit={(userId) => {
            setAppState({
              step: 'world',
              mode: WorldMode.PITCH,
              pitchContext: {
                company: appState.company,
                agentIds: appState.agentIds,
                userId,
              },
            });
          }}
          onBack={() => setAppState({ step: 'companyContext' })}
        />
      );

    case 'world':
      return (
        <CharacterWorld
          initialMode={appState.mode}
          onBack={handleBack}
          pitchContext={appState.pitchContext}
        />
      );

    default:
      return <LandingPage onSelectMode={handleSelectMode} />;
  }
}

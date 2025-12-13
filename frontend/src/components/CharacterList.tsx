/**
 * Character list component displaying all characters in the simulation
 */

'use client';

import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CharacterCard } from '@/src/components/CharacterCard';
import { CharacterDetail } from '@/src/components/CharacterDetail';
import type { Character } from '@/src/types/character';

interface CharacterListProps {
  characters: Character[];
}

export function CharacterList({ characters }: CharacterListProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  if (characters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center px-4">
        <div className="space-y-2">
          <p className="text-sm font-normal text-muted-foreground">No characters</p>
          <p className="text-xs text-muted-foreground">The simulation has no characters loaded</p>
        </div>
      </div>
    );
  }

  // Show detail view if a character is selected
  if (selectedCharacter) {
    return (
      <div className="h-full overflow-hidden">
        <CharacterDetail
          character={selectedCharacter}
          onBack={() => setSelectedCharacter(null)}
        />
      </div>
    );
  }

  // Show list view
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-4">
        {characters.map((character) => (
          <div key={character.id} onClick={() => setSelectedCharacter(character)}>
            <CharacterCard character={character} />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/**
 * Character card component for displaying individual characters in the Technocrats list
 */

'use client';

import { User2, UserRound } from 'lucide-react';
import type { Character } from '@/src/types/character';

interface CharacterCardProps {
  character: Character;
}

export function CharacterCard({ character }: CharacterCardProps) {
  const formattedId = `#${character.id.toString().padStart(4, '0')}`;
  const GenderIcon = character.gender === 'male' ? User2 : UserRound;

  return (
    <div className="flex gap-3 p-3 bg-sidebar-accent rounded-lg border border-sidebar-border hover:bg-sidebar-accent/80 transition-colors cursor-pointer">
      {/* Avatar - shows front-facing view (row 2) first frame from sprite sheet */}
      <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden bg-sidebar border border-sidebar-border relative">
        <img
          src={character.sprites.idle.url}
          alt={`Character ${formattedId}`}
          className="absolute"
          style={{
            width: '900%', // 9 frames × 100%
            height: '400%', // 4 rows × 100%
            left: '-17%',
            top: '-305%', // Offset by 2 rows to show row 2 (front-facing view)
            objectFit: 'none',
            objectPosition: 'top left',
            imageRendering: 'pixelated',
          }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-sidebar-foreground">
            {character.name}
          </span>
          <GenderIcon className="size-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground ml-auto">
            {formattedId}
          </span>
        </div>
        <p className="text-xs font-normal text-muted-foreground line-clamp-2 leading-relaxed">
          {character.persona}
        </p>
      </div>
    </div>
  );
}

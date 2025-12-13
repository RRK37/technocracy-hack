/**
 * Character detail view component showing full character information
 */

'use client';

import { ArrowLeft, User2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Character } from '@/src/types/character';

interface CharacterDetailProps {
  character: Character;
  onBack: () => void;
}

export function CharacterDetail({ character, onBack }: CharacterDetailProps) {
  const formattedId = `#${character.id.toString().padStart(4, '0')}`;
  const GenderIcon = character.gender === 'male' ? User2 : UserRound;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sidebar">
      {/* Header with back button */}
      <div className="shrink-0 border-b border-sidebar-border px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 px-2 text-xs font-normal text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to list
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-6">
            {/* Character Avatar - Large */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-32 rounded-lg overflow-hidden bg-sidebar-accent border border-sidebar-border relative">
                <img
                  src={character.sprites.idle.url}
                  alt={`Character ${formattedId}`}
                  className="absolute"
                  style={{
                    width: '450%', // 9 frames × 100%
                    height: '200%', // 4 rows × 100%
                    left: '-52%',
                    top: '-110%', // Offset by 2 rows to show row 2 (front-facing view)
                    objectFit: 'none',
                    scale: 2,
                    objectPosition: 'top left',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-medium text-sidebar-foreground">{character.name}</h2>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <GenderIcon className="size-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{formattedId}</span>
                </div>
              </div>
            </div>

            {/* Persona */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-sidebar-foreground uppercase tracking-wide">
                Persona
              </h3>
              <p className="text-xs font-normal text-muted-foreground leading-relaxed">
                {character.persona}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-sidebar-foreground uppercase tracking-wide">
                Appearance
              </h3>
              <p className="text-xs font-normal text-muted-foreground leading-relaxed">
                {character.description}
              </p>
            </div>

            {/* Attributes */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-sidebar-foreground uppercase tracking-wide">
                Attributes
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <AttributeItem label="Skin" value={formatAttribute(character.attributes.skin_color)} />
                <AttributeItem label="Hair Color" value={formatAttribute(character.attributes.hair_color)} />
                <AttributeItem label="Hair Style" value={formatAttribute(character.attributes.hair_style)} />
                <AttributeItem label="Shirt" value={formatAttribute(character.attributes.shirt_color)} />
                <AttributeItem label="Legs" value={formatAttribute(character.attributes.leg_color)} />
                <AttributeItem label="Leg Type" value={formatAttribute(character.attributes.leg_type)} />
                <AttributeItem label="Shoes" value={formatAttribute(character.attributes.shoe_color)} />
              </div>
            </div>

          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function AttributeItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-2 bg-sidebar-accent rounded border border-sidebar-border">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-normal text-sidebar-foreground">{value}</span>
    </div>
  );
}

function formatAttribute(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

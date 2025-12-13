/**
 * Hook to load character data using TanStack Query
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CharactersData, Character } from '@/src/types/character';
import { WORLD_CONFIG } from '@/src/lib/world';

/**
 * Fetch character data from the JSON file
 */
async function fetchCharacterData(): Promise<CharactersData> {
  const response = await fetch('/all-characters-pitch.json');
  if (!response.ok) {
    throw new Error('Failed to load character data');
  }
  const rawData = await response.json();

  // Handle flat pitch JSON format (characters at root level)
  if (!rawData.characters) {
    // Mapping from character name to actual folder ID
    const nameToFolder: Record<string, string> = {
      'Henry Allen': '227243',
      'Roméo Walter': '135817',
      'Alexandra Tsylnitska': '824612',
      'Zoe (Ziwen) Qin': '728351',
      'Ties Boukema': '863407',
      'An N.': '532287',
      'Haakon Overli': '194266',
      'Skye Fletcher': '185003',
    };

    // Convert flat format to expected format
    const characters: Record<string, Character> = {};
    for (const key of Object.keys(rawData)) {
      if (key.startsWith('character_')) {
        const charData = rawData[key];
        const folderId = nameToFolder[charData.name] || charData.id;
        // Map to expected Character structure
        characters[key] = {
          id: parseInt(charData.id, 10),
          name: charData.name,
          persona: charData.persona,
          gender: 'male' as const, // Default
          description: charData.persona,
          attributes: {
            skin_color: 'light',
            hair_color: 'brown',
            hair_style: 'short',
            shirt_color: 'blue',
            leg_color: 'gray',
            leg_type: 'pants' as const,
            shoe_color: 'black',
          },
          sprites: {
            idle: { url: `/characters-pitch/character_${folderId}/sprite_idle.png`, generated: '', layers: [] },
            walk: { url: `/characters-pitch/character_${folderId}/sprite_walk.png`, generated: '', layers: [] },
            sit: { url: `/characters-pitch/character_${folderId}/sprite_sit.png`, generated: '', layers: [] },
          },
        };
      }
    }
    return {
      version: '1.0',
      totalCharacters: Object.keys(characters).length,
      generatedAt: new Date().toISOString(),
      characters,
    };
  }

  return rawData;
}

/**
 * Select the first N characters by ID
 */
function selectFirstCharacters(
  charactersData: CharactersData,
  count: number
): Character[] {
  const allCharacters = Object.values(charactersData.characters);

  // Sort by ID and select first N characters
  const sorted = [...allCharacters].sort((a, b) => a.id - b.id);
  return sorted.slice(0, count);
}

/**
 * Hook to load and select the first N characters
 */
export function useCharacterData(count: number = WORLD_CONFIG.NUM_CHARACTERS) {
  const query = useQuery({
    queryKey: ['characters'],
    queryFn: fetchCharacterData,
    staleTime: Infinity, // Data never goes stale
    gcTime: Infinity, // Keep in cache forever
  });

  // Select first N characters from the loaded data (memoized to prevent re-selection on every render)
  const selectedCharacters = useMemo(() => {
    return query.data ? selectFirstCharacters(query.data, count) : [];
  }, [query.data, count]);

  return {
    characters: selectedCharacters,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

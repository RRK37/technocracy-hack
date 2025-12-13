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
  const response = await fetch('/characters/data/all-characters.json');
  if (!response.ok) {
    throw new Error('Failed to load character data');
  }
  return response.json();
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

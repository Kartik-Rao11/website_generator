// useWebContainer.ts
import { WebContainer } from '@webcontainer/api';
import { useState, useEffect, useRef } from 'react';

export function useWebContainer() {
  const [webcontainer, setWebContainer] = useState<WebContainer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const instanceRef = useRef<WebContainer | null>(null);

  useEffect(() => {
    // Only initialize if not already initialized
    if (instanceRef.current) return;

    async function initializeWebContainer() {
      try {
        if (instanceRef.current) return;

        const container = await WebContainer.boot();
        instanceRef.current = container;
        setWebContainer(container);
      } catch (err) {
        console.error('Failed to initialize WebContainer:', err);
        setError(err instanceof Error ? err.message : 'Unknown initialization error');
      }
    }

    initializeWebContainer();

    // Cleanup function
    return () => {
      // Instead of destroy, we'll just null out the reference
      instanceRef.current = null;
      setWebContainer(null);
    };
  }, []); // Empty dependency array ensures this runs only once

  return { webcontainer, error };
}
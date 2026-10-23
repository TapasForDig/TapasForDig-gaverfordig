'use client';

import { useEffect } from 'react';

// Tømmer den gemte kurv, når bestillingen er gennemført
export function ClearCart() {
  useEffect(() => {
    try {
      localStorage.removeItem('gfd-bestilling-v1');
    } catch {}
  }, []);
  return null;
}

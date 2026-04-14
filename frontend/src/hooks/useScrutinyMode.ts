'use client';
import { useState, useCallback } from 'react';

export function useScrutinyMode() {
  const [scrutinyOn, setScrutinyOn] = useState(false);

  const toggle = useCallback(() => setScrutinyOn((v) => !v), []);
  const enable = useCallback(() => setScrutinyOn(true), []);
  const disable = useCallback(() => setScrutinyOn(false), []);

  return { scrutinyOn, toggle, enable, disable };
}

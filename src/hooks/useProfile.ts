'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'cartlist_profile_id';

export function useProfile() {
  const [profileId, setProfileIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProfileIdState(localStorage.getItem(STORAGE_KEY));
    setHydrated(true);
  }, []);

  const setProfileId = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setProfileIdState(id);
  };

  const clearProfile = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProfileIdState(null);
  };

  return { profileId, setProfileId, clearProfile, hydrated };
}

import { Slot, Redirect, usePathname } from 'expo-router';

import { isPlayerApp } from '@/config/app-mode';

export default function ProjectIdLayout() {
  const pathname = usePathname();

  if (isPlayerApp() && !pathname.endsWith('/play')) {
    return <Redirect href="/player" />;
  }

  return <Slot />;
}

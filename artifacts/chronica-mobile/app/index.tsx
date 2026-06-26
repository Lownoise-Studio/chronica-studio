import { Redirect } from 'expo-router';

import { getAppHomeHref } from '@/config/app-mode';

export default function Index() {
  return <Redirect href={getAppHomeHref()} />;
}

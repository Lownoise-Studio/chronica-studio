import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProjectsProvider } from "@/context/ProjectsContext";
import { AdvancedModeProvider } from "@/context/AdvancedModeContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#13121a" },
        headerTintColor: "#e8e6f0",
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        contentStyle: { backgroundColor: "#0a0a0f" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="player/index" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/index" options={{ title: "Project" }} />
      <Stack.Screen name="project/[id]/graph" options={{ title: "Story Graph" }} />
      <Stack.Screen name="project/[id]/fragment/[uid]" options={{ title: "Scene" }} />
      <Stack.Screen name="project/[id]/assets" options={{ title: "Assets" }} />
      <Stack.Screen name="project/[id]/characters" options={{ title: "Cast" }} />
      <Stack.Screen name="project/[id]/play" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/settings" options={{ title: "Settings" }} />
      <Stack.Screen name="project/[id]/export" options={{ title: "Export / Import" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <View style={styles.root} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AdvancedModeProvider>
              <ProjectsProvider>
                <GestureHandlerRootView style={styles.root}>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </ProjectsProvider>
            </AdvancedModeProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

import { SplashScreen, Stack } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { usePanchangLocation } from "../services/panchangService";
import { LocationPickerModal } from "../components/LocationPicker";
import CustomSplashScreen from "@/components/SplashScreen";
import { mantraService } from "@/services/mantraService";
import { bhajanService } from "@/services/bhajanService";
import { artistService } from "@/services/artistsService";
import * as Speech from "expo-speech";
import { SidebarProvider } from "@/components/SideBar";
import { AppHeader } from "./(tabs)/_layout";
import { ThemeProvider } from "@/theme";
import { LanguageProvider } from "@/localization";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const loc = usePanchangLocation();
  const [appReady, setAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  const prepareApp = useCallback(async () => {
    try {
      await Promise.all([
        mantraService.init(),
        bhajanService.init(),
        artistService.init(),
        Speech.getAvailableVoicesAsync(),
      ]);
    } catch (e) {
      console.warn(e);
    } finally {
      setAppReady(true);
      await SplashScreen.hideAsync();
    }
  }, []);

  useEffect(() => {
    prepareApp();
  }, []);

  if (!appReady) {
    return null; // Native splash stays visible
  }

  if (showCustomSplash) {
    return (
      <CustomSplashScreen
        onFinish={() => setShowCustomSplash(false)}
        appName="पञ्चाङ्ग"
        tagline="Panchang • Bhajan • Jap • Gita"
      />
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SidebarProvider>
              <Stack
                screenOptions={{
                  // Use our custom header for every tab screen
                  header: () => <AppHeader />,
                }}
              >
                <Stack.Screen name="(tabs)" />
              </Stack>
              <LocationPickerModal
                visible={loc.status === "denied"}
                onDetectGPS={loc.detectGPS}
                onPickCity={loc.pickCity}
                error={loc.error}
              />
            </SidebarProvider>
          </GestureHandlerRootView>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

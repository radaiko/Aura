import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UpdateStatus {
  update_available: boolean;
  version: string | null;
}

type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "installing" | "error";

export function useUpdater() {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    setPhase("checking");
    setError(null);
    try {
      const status = await invoke<UpdateStatus>("check_for_updates");
      if (status.update_available) {
        setVersion(status.version);
        setPhase("available");
      } else {
        setPhase("idle");
      }
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    setPhase("downloading");
    setError(null);
    try {
      await invoke("download_update");
      setPhase("installing");
      await invoke("install_update");
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  }, []);

  // Check on startup, then every hour
  useEffect(() => {
    checkForUpdates();
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  return { phase, version, error, checkForUpdates, downloadAndInstall };
}

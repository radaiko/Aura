use serde::Serialize;
use std::sync::Mutex;
use tauri::State;
use velopack::*;

const UPDATE_URL: &str = "https://github.com/radaiko/Aura/releases/latest/download";

fn current_channel() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    { "osx-arm64" }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    { "osx-x64" }
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    { "win-x64" }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    { "linux-x64" }
}

pub struct UpdaterState(pub Mutex<Option<UpdateManager>>);

#[derive(Serialize, Clone)]
pub struct UpdateStatus {
    pub update_available: bool,
    pub version: Option<String>,
}

fn get_manager() -> Result<UpdateManager, String> {
    let source = sources::HttpSource::new(UPDATE_URL);
    let options = UpdateOptions {
        ExplicitChannel: Some(current_channel().to_string()),
        ..Default::default()
    };
    UpdateManager::new(source, Some(options), None).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_for_updates(
    state: State<'_, UpdaterState>,
) -> Result<UpdateStatus, String> {
    let um = get_manager()?;

    match um.check_for_updates().map_err(|e| e.to_string())? {
        UpdateCheck::UpdateAvailable(info) => {
            let version = info.TargetFullRelease.Version.to_string();
            *state.0.lock().unwrap() = Some(um);
            Ok(UpdateStatus {
                update_available: true,
                version: Some(version),
            })
        }
        _ => Ok(UpdateStatus {
            update_available: false,
            version: None,
        }),
    }
}

#[tauri::command]
pub async fn download_update(state: State<'_, UpdaterState>) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let um = guard.as_ref().ok_or("No update manager — check for updates first")?;

    match um.check_for_updates().map_err(|e| e.to_string())? {
        UpdateCheck::UpdateAvailable(info) => {
            um.download_updates(&info, None).map_err(|e| e.to_string())?;
            Ok(())
        }
        _ => Err("No update available".into()),
    }
}

#[tauri::command]
pub async fn install_update(state: State<'_, UpdaterState>) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let um = guard.as_ref().ok_or("No update manager")?;

    match um.check_for_updates().map_err(|e| e.to_string())? {
        UpdateCheck::UpdateAvailable(info) => {
            um.apply_updates_and_restart(&info).map_err(|e| e.to_string())?;
            Ok(())
        }
        _ => Err("No update available".into()),
    }
}

use serde_json::Value;
use tauri::path::BaseDirectory;
use tauri::{App, AppHandle, Manager, Runtime, Wry};
use tauri_plugin_store::{Error, StoreExt};

pub const SETTING_PATH: &str = "resources/setting.json";

pub mod prop {
    /// last datasource id
    pub const P_LAST_DATASOURCE: &str = "last_datasource";
    pub const P_REDIS_KEY_SEPA: &str = "f_separator";
}

pub fn initialize(app: &mut App<Wry>) -> Result<(), Error> {
    let resource_path = &app.path().resolve(SETTING_PATH, BaseDirectory::AppData)?;
    let store = app.store(&resource_path)?;
    let initialized = store.get(prop::P_LAST_DATASOURCE).unwrap_or(Value::Bool(false));

    if !initialized.as_bool().unwrap_or(false) {
        store.set(prop::P_REDIS_KEY_SEPA, ":");
        store.save()?;
    }
    Ok(())
}

/// get system property from store by provided `key`
pub async fn get_prop<R, K>(handle: AppHandle<R>, key: K) -> Option<Value>
where
    K: AsRef<str>,
    R: Runtime,
{
    match handle.store(SETTING_PATH) {
        Ok(val) => {
            match val.get(key) {
                None => None,
                Some(val) => Some(val)
            }
        }
        Err(_) => {
            None
        }
    }
}

/// set system property
pub async fn set_prop<R, K>(handle: AppHandle<R>, key: K, val: Value)
where
    R: Runtime,
    K: AsRef<str>,
{
    match handle.store(SETTING_PATH) {
        Ok(store) => {
            store.set(key.as_ref(), val);
        }
        Err(_) => {}
    }
}


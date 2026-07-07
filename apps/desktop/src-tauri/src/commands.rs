fn secret_name(provider: &str) -> String {
    format!("workbuddy.{}.api_key", provider)
}

#[tauri::command]
pub fn set_api_key(provider: String, api_key: String) -> Result<(), String> {
    let entry = keyring::Entry::new("WorkBuddy", &secret_name(&provider))
        .map_err(|error| error.to_string())?;
    entry
        .set_password(&api_key)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_api_key(provider: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new("WorkBuddy", &secret_name(&provider))
        .map_err(|error| error.to_string())?;

    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn delete_api_key(provider: String) -> Result<(), String> {
    let entry = keyring::Entry::new("WorkBuddy", &secret_name(&provider))
        .map_err(|error| error.to_string())?;

    match entry.delete_password() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

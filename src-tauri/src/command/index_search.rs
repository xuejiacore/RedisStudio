use crate::CmdError;
use serde::{Serialize, Serializer};
use serde_json::json;
use tantivy::TantivyError;
use tauri::ipc::InvokeError;
use tauri::{Runtime, State, Wry};
use tauri_plugin_sql::Error;

use crate::indexer::tantivy_indexer::TantivyIndexer;

type Result<T> = std::result::Result<T, CmdError>;

/// search documents by provided query string.
#[tauri::command]
pub async fn search<R: Runtime>(
    index_name: &str,
    query: &str,
    limit: usize,
    offset: usize,
    indexer: State<'_, TantivyIndexer>,
    handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
) -> Result<String> {
    println!("search index: {}, query: {}", index_name, query);
    match indexer.search(index_name, query, limit, offset).await {
        Ok(result) => Ok(serde_json::to_string(&result).unwrap()),
        Err(err) => Err(CmdError::Unknown(String::from("sdd"))),
    }
}

/// add document to index.
#[tauri::command]
pub async fn write_index<R: Runtime>(
    index_name: &str,
    document: &str,
    indexer: State<'_, TantivyIndexer>,
    handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
) -> Result<String> {
    match indexer.write(index_name, document).await {
        Ok(_) => Ok(json!({"success": true}).to_string()),
        Err(err) => Err(CmdError::Unknown(String::from("sdd"))),
    }
}

use crate::menu;
use crate::menu::menu_manager::MenuContext;
use std::collections::HashMap;
use tauri::menu::MenuEvent;
use tauri::{Manager, State, Window};

/// process the menu event of main window
pub fn process_main_menu(window: &Window, event: MenuEvent) {
    let menu_id = &event.id;
    let menu_id_val = menu_id.0.clone();
    let t: Vec<&str> = menu_id_val.split("@").collect();
    let menu_group = t[0];
    let menu_id = t[1];

    let menu_context: State<'_, MenuContext> = window.state();
    let context = menu_context.get_context(menu_group).unwrap_or(HashMap::new());
    match menu_group {
        menu::MENU_ADD_NEW_KEY_MENU => process_add_new_key(window, event, menu_id, context),
        menu::MENU_OPERATOR_MENU => process_type_operator(window, event, menu_id, context),
        &_ => {}
    }
}

/// create new key
fn process_add_new_key(window: &Window, event: MenuEvent, menu_id: &str, context: HashMap<String, String>) {
    let datasource = context.get("datasource").expect("data not exists");
    let key_type = menu_id;
    let win = window.get_webview_window("create-new-key").unwrap();
    win.eval(format!("window.onCreateNewKey('{}', '{}')", key_type, datasource).as_str()).unwrap();
    win.show().unwrap();
}

/// type operator
fn process_type_operator(window: &Window, event: MenuEvent, menu_id: &str, context: HashMap<String, String>) {}
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::menu::MenuId;

pub struct SceneMenuId {
    menu_name: String,
    id: String,
}

impl SceneMenuId {
    pub(crate) fn new(menu_name: &str, id: &str) -> SceneMenuId {
        SceneMenuId {
            menu_name: String::from(menu_name),
            id: String::from(id),
        }
    }
}

impl Into<MenuId> for SceneMenuId {
    fn into(self) -> MenuId {
        format!("{}#{}", self.menu_name, self.id).into()
    }
}

pub struct MenuContext {
    context_map: Arc<Mutex<HashMap<String, HashMap<String, String>>>>,
}

impl MenuContext {
    pub fn new() -> Self {
        MenuContext {
            context_map: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn set_context<T>(&self, menu_name: T, context_map: HashMap<String, String>)
    where
        T: AsRef<str>,
    {
        self.context_map.lock().unwrap().insert(String::from(menu_name.as_ref()), context_map);
    }

    pub fn get_context<T>(&self, menu_name: T) -> Option<HashMap<String, String>>
    where
        T: AsRef<str>,
    {
        self.context_map.lock().unwrap().get(menu_name.as_ref()).cloned()
    }
}


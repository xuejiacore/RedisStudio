use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct MenuContext {
    context_map: Arc<Mutex<HashMap<String, HashMap<String, String>>>>,
}

impl MenuContext {
    pub fn new() -> Self {
        MenuContext {
            context_map: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn set_context(&self, menu_name: String, context_map: HashMap<String, String>) {
        self.context_map.lock().unwrap().insert(menu_name, context_map);
    }

    pub fn get_context(&self, menu_name: String) -> Option<HashMap<String, String>> {
        self.context_map.lock().unwrap().get(&menu_name).cloned()
    }
}


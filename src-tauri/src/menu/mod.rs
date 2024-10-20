pub mod menu_manager;
pub mod main_menu;

// ------------------------------ add new key menu ------------------------------
pub const MENU_ADD_NEW_KEY_MENU: &str = "show_add_new_key_menu";

pub const MID_ADD_STRING: &str = "show_add_new_key_menu@string";
pub const MID_ADD_HASH: &str = "show_add_new_key_menu@hash";
pub const MID_ADD_LIST: &str = "show_add_new_key_menu@list";
pub const MID_ADD_SET: &str = "show_add_new_key_menu@set";
pub const MID_ADD_ZSET: &str = "show_add_new_key_menu@zset";

// ------------------------------ key tree right click menu ------------------------------

pub const MENU_KEY_TREE_RIGHT_CLICK: &str = "show_key_tree_right_menu";

pub const MID_COPY_KEY_NAME: &str = "show_key_tree_right_menu@copy_key_name";
pub const MID_DUPLICATE: &str = "show_key_tree_right_menu@duplicate";
pub const MID_DELETE_KEY: &str = "show_key_tree_right_menu@delete";

// ------------------------------ key operator right menu ------------------------------
pub const MENU_OPERATOR_MENU: &str = "show_content_editor_menu";

pub const MID_KEY_OP_ADD_ROW: &str = "show_content_editor_menu@add_row";
pub const MID_KEY_OP_CP_AS_CMD: &str = "show_content_editor_menu@key_as_cmd";
pub const MID_KEY_OP_CP_AS_TSV: &str = "show_content_editor_menu@key_as_tsv";
pub const MID_KEY_OP_CP_AS_CSV: &str = "show_content_editor_menu@key_as_csv";
pub const MID_KEY_OP_DELETE: &str = "show_content_editor_menu@key_del";
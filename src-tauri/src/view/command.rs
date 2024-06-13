use crate::Launcher;

#[derive(Copy, Clone)]
pub struct CommandDispatcher {
    launcher: Launcher,
}

impl CommandDispatcher {
    pub fn new(launcher: Launcher) -> Self {
        CommandDispatcher { launcher }
    }

    pub fn dispatch(&self, cmd_data: &str) -> String {
        println!("dispatch command: {}", cmd_data);
        return "{}".to_string();
    }

    pub fn setup(&self) {
        self.launcher.setup();
    }
}

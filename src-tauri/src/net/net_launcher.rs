/// setup and launch net system
///
/// # Examples
///
/// ```
/// ```
pub fn setup() {
    let manager = NetManager::new();
    std::thread::sleep(std::time::Duration::from_secs(2));
    manager.start_service_broadcast();
}

/// network manager
struct NetManager {}

impl NetManager {
    fn new() -> Self {
        NetManager {}
    }

    fn start_service_broadcast(&self) {
        println!("start service broadcast...");
    }
}

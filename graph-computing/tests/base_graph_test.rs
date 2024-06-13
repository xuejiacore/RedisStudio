#[test]
fn test() {
    use std::net::UdpSocket;
    use std::thread;
    let socket = UdpSocket::bind("0.0.0.0:12342").unwrap();
    socket.send_to("&buf[0..count]".as_ref(), "224.0.0.1:12341").unwrap();
}
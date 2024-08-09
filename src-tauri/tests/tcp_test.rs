use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt, split};

#[tokio::test]
async fn it_works() {
    let listener = TcpListener::bind("localhost:7732").await.unwrap();

    loop {
        let (local_stream, _) = listener.accept().await.unwrap();
        let (mut read, write) = split(local_stream);
        let mut buffer = [0; 1024];
        loop {
            match read.read(&mut buffer).await {
                Ok(n) => {
                    if n == 0 {
                        break;
                    }
                    println!("Sent to remote: {:?}", &buffer[0..n]);
                }
                Err(err) => {
                    eprintln!("Failed to read from local: {:?}", err);
                    break;
                }
            }
        }
    }
}
use std::io::Read;
use std::io::Write;
use std::net::TcpStream as StdTcpStream;
use std::path::Path;
use std::sync::Arc;

use anyhow::Result;
use ssh2::Session;
use tokio::io::{AsyncReadExt, AsyncWriteExt, split};
use tokio::net::TcpListener;
use tokio::sync::RwLock;

#[tokio::test]
async fn test_ssh_tunnel() -> Result<()> {
    let ssh_host = "172.31.65.68";
    let ssh_port = 59522;
    let tcp = StdTcpStream::connect(format!("{}:{}", ssh_host, ssh_port)).expect("Failed to connect to SSH server");
    let mut sess = Session::new().unwrap();
    sess.set_tcp_stream(tcp);
    let pub_key = Path::new("/Users/nigel/.ssh/company-ssh-key/id_rsa_2021-03-06.pub");
    let pri_key = Path::new("/Users/nigel/.ssh/company-ssh-key/id_dsa");
    sess.handshake()?;
    sess.userauth_pubkey_file("root", Some(&pub_key), &pri_key, None)?;
    if !sess.authenticated() {
        eprintln!("Authentication failed");
        return Ok(());
    } else {
        println!("Authentication success.");
    }

    let local_host = "0.0.0.0";
    let local_port = 7732;
    let listener = TcpListener::bind(format!("{}:{}", local_host, local_port)).await.unwrap();
    let session = Arc::new(RwLock::new(sess));

    // let remote_host = "r-j6cfe8bcz1kvugyibr.redis.rds.aliyuncs.com";
    let remote_host = "172.31.66.246";
    let remote_port = 7734;

    loop {
        let (local_stream, _) = listener.accept().await.unwrap();
        let session = Arc::clone(&session);

        tokio::spawn(async move {
            let session = session.write().await;

            let channel = match session.channel_direct_tcpip(remote_host, remote_port, None) {
                Ok(channel) => Arc::new(RwLock::new(channel)),
                Err(err) => {
                    eprintln!("Failed to create channel: {:?}", err);
                    return;
                }
            };

            let (mut local_reader, mut local_writer) = split(local_stream);

            let local_to_remote = {
                let channel_clone = Arc::clone(&channel);
                tokio::spawn(async move {
                    let mut buffer = [0; 1024];
                    loop {
                        println!("local reading...");
                        match local_reader.read(&mut buffer).await {
                            Ok(n) => {
                                println!("Read {} bytes from local.", n);
                                if n == 0 {
                                    println!("No more data from local. Closing...");
                                    break;
                                }
                                let mut channel = channel_clone.write().await;
                                if let Err(err) = channel.write_all(&buffer[0..n]) {
                                    eprintln!("Failed to write to remote: {:?}", err);
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
                    println!("Local to remote transfer completed.");
                })
            };

            let remote_to_local = {
                let channel_clone = Arc::clone(&channel);
                tokio::spawn(async move {
                    let mut buffer = [0; 1024];
                    loop {
                        println!("remote reading...");
                        let mut channel = channel_clone.write().await;
                        match channel.read(&mut buffer) {
                            Ok(n) => {
                                println!("Read {} bytes from remote.", n);
                                if n == 0 {
                                    println!("No more data from remote. Closing...");
                                    break;
                                }
                                if let Err(err) = local_writer.write_all(&buffer[0..n]).await {
                                    eprintln!("Failed to write to local: {:?}", err);
                                    break;
                                }
                                println!("Received from remote: {:?}", &buffer[0..n]);
                            }
                            Err(err) => {
                                eprintln!("Failed to read from remote: {:?}", err);
                                break;
                            }
                        }
                    }
                    println!("Remote to local transfer completed.");
                })
            };

            // Join the tasks and handle potential errors
            if let Err(err) = tokio::try_join!(local_to_remote, remote_to_local) {
                eprintln!("Error during data transfer: {:?}", err);
            }
        });
    }
}

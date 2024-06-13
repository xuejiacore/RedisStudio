use redis::{Cmd, Connection};

#[test]
fn test() {
    let client = redis::Client::open("redis://127.0.0.1/").unwrap();
    let mut con = client.get_connection().unwrap();

    match Cmd::new()
        .arg("HGETALL")
        .arg("newbattle:750001449")
        .query::<Vec<String>>(&mut con)
    {
        Ok(val) => {
            println!("{:?}", val);
        }
        Err(e) => {}
    };
}

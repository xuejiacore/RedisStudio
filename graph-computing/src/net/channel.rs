use std::ops::Deref;

use tokio::sync::broadcast;
use tokio::sync::broadcast::{Receiver, Sender};

use crate::row::proto_row::Row;
use crate::units::computing_units::Unit;

/// Base channel for transfer data
pub trait Channel {
    /// Write data to custom logic. see also [MuteChannel], [PrintChannel], [RuntimeChannel]
    fn write(&self, row: Row);
}

pub trait ChannelReceiver {
    fn recv(&self, row: Row);
}

/// Silent channel which will ignore write
pub struct MuteChannel {}

impl Channel for MuteChannel {
    fn write(&self, row: Row) {}
}

/// Simple print channel
pub struct PrintChannel {}

impl PrintChannel {
    pub fn new() -> Self {
        PrintChannel {}
    }
}

impl Channel for PrintChannel {
    fn write(&self, row: Row) {
        println!("{}", row);
    }
}

/// Socket channel for transfer data
///
/// # Examples
///
/// ```
/// ```
pub struct RuntimeChannel {
    id: String,
    broadcast_channel: (Sender<Row>, Receiver<Row>),
    receivers: Vec<Receiver<Row>>,
}

impl Channel for RuntimeChannel {
    /// write data to socket
    fn write(&self, row: Row) {
        self.broadcast_channel.0.send(row).unwrap();
    }
}

impl RuntimeChannel {
    pub fn new(id: &str) -> Self {
        RuntimeChannel {
            id: String::from(id),
            broadcast_channel: broadcast::channel(1024),
            receivers: vec![],
        }
    }

    pub(crate) fn get_id(&self) -> String {
        self.id.clone()
    }

    pub(crate) fn subscribe(&self, related_channel: &RuntimeChannel, consumer: fn(&Row)) {
        let mut receiver = related_channel.broadcast_channel.0.subscribe();

        let sender = self.broadcast_channel.0.clone();
        let id = self.id.clone();
        tokio::spawn(async move {
            loop {
                match receiver.recv().await {
                    Ok(row) => {
                        consumer(&row);
                        //sender.send(row).unwrap();
                    }
                    Err(_) => {
                        println!("error");
                        break;
                    }
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use crate::net::channel::{Channel, ChannelReceiver, RuntimeChannel};
    use crate::row::proto_row::{Column, Row};

    #[derive(Copy, Clone)]
    struct PrintReceiver {}

    impl PrintReceiver {
        fn new() -> Self {
            PrintReceiver {}
        }
    }

    impl ChannelReceiver for PrintReceiver {
        fn recv(&self, row: Row) {
            println!("received data: {}", row);
        }
    }

    #[tokio::test]
    async fn broadcast_test() {
        let rt_channel1 = RuntimeChannel::new("r1");
        let mut rt_channel2 = RuntimeChannel::new("r2");
        let mut rt_channel3 = RuntimeChannel::new("r3");
        let mut rt_channel4 = RuntimeChannel::new("r4");

        let mut rt_channel2_3_4 = RuntimeChannel::new("r234");
        let mut rt_channel5 = RuntimeChannel::new("r5");
        let mut rt_channel6 = RuntimeChannel::new("r6");

        rt_channel2.subscribe(&rt_channel1, |r| {});
        rt_channel3.subscribe(&rt_channel1, |r| {});
        rt_channel4.subscribe(&rt_channel1, |r| {});

        rt_channel2_3_4.subscribe(&rt_channel2, |r| {});
        rt_channel2_3_4.subscribe(&rt_channel3, |r| {});
        rt_channel2_3_4.subscribe(&rt_channel4, |r| {});

        rt_channel5.subscribe(&rt_channel2_3_4, |r| {});
        rt_channel6.subscribe(&rt_channel5, |r| {});

        tokio::time::sleep(Duration::from_secs(1)).await;

        let mut row = Row::new();
        let mut column = Column::new();
        column.i64_val = 44;
        row.columns = vec![column];

        rt_channel1.write(row);

        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}
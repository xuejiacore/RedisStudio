use crate::net::channel::{Channel, RuntimeChannel};
use crate::row::proto_row::Row;
use crate::units::computing_units::Unit;

/// Computing unit context. Including data transfer channel definition and runtime context.
pub struct UnitContext {
    // channel for current context
    channel: Box<RuntimeChannel>,
}

impl UnitContext {
    pub fn new_with_id(id: &str) -> Box<Self> {
        Box::new(UnitContext {
            channel: Box::new(RuntimeChannel::new(id)),
        })
    }
    pub fn new() -> Box<Self> {
        Self::new_with_id(Default::default())
    }

    /// set new channel for this computing unit context
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn set_channel(&mut self, channel: Box<RuntimeChannel>) {
        self.channel = channel;
    }

    pub(crate) fn channel(&self) -> &Box<RuntimeChannel> {
        &self.channel
    }
}

/// Toolkit for the [UnitContext]
///
/// # Examples
///
/// ```
/// ```
pub trait ContextToolKit {
    fn write(&self, ctx: &UnitContext, row: Row) -> Result<bool, Box<dyn std::error::Error>> {
        ctx.channel.write(row);
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use crate::net::channel::RuntimeChannel;
    use crate::row::proto_row::{Column, Row};
    use crate::units::context::{ContextToolKit, UnitContext};

    pub struct ExampleUnit {}

    impl ContextToolKit for ExampleUnit {}

    impl ExampleUnit {
        pub fn new() -> Self {
            Self {}
        }
    }

    #[test]
    fn test_context_write() {
        let mut context = UnitContext::new();
        context.set_channel(Box::new(RuntimeChannel::new(Default::default())));

        let unit = ExampleUnit::new();

        let mut row = Row::new();
        let mut column = Column::new();
        column.field = "test_field_name".to_string();
        column.i64_val = 80;
        row.columns = vec![column.clone(), column.clone()];
        unit.write(&context, row).unwrap();
    }
}


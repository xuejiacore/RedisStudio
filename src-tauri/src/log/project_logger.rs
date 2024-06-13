use chrono::format::strftime;
use chrono::{DateTime, Local, NaiveDateTime};
use env_logger::{Builder, Env};
use log::debug;
use std::fmt::{Debug, Formatter};
use std::io::Write;

pub fn init_logger() {
    let env = Env::default()
        .filter("RUST_LOG")
        .write_style("MY_LOG_STYLE");

    Builder::from_env(env)
        .format(|buf, record| {
            // We are reusing `anstyle` but there are `anstyle-*` crates to adapt it to your
            // preferred styling crate.
            let warn_style = buf.default_level_style(log::Level::Debug);
            // 获取当前本地时间
            let now = Local::now();
            // 获取毫秒数
            let milliseconds = now.timestamp_millis() % 1000;
            // 格式化日期和时间，但不包括毫秒
            let formatted_without_millis = now.format("%Y-%m-%d %H:%M:%S");
            // 手动添加毫秒到格式化字符串中
            let formatted_with_millis = format!("{}.{:03}", formatted_without_millis, milliseconds);

            writeln!(
                buf,
                "{formatted_with_millis}: {warn_style}{}{warn_style:#}",
                record.args()
            )
        })
        .init();
    debug!("logger initialized.")
}

use std::option::Option;
use std::sync::Arc;
use std::time::Duration;

use calamine::Reader;
use protobuf::EnumOrUnknown;
use crate::net::channel::Channel;

use crate::row::proto_row::{Column, DataType, Row};
use crate::units::computing_units::{BaseUnit, LuaUnit, Unit, UnitConfig, UnitLifecycle};
use crate::units::context::{ContextToolKit, UnitContext};

pub struct PrintUnit {
    unit_config: UnitConfig,
    base_unit: BaseUnit,
}

impl Unit for PrintUnit {}

impl LuaUnit for PrintUnit {
    fn load_lua_source(&self) -> String {
        self.unit_config.get_lua_source()
    }
}

impl PrintUnit {
    pub(crate) fn new(unit_config: Box<UnitConfig>) -> Box<PrintUnit> {
        Box::new(PrintUnit {
            unit_config: *unit_config,
            base_unit: BaseUnit::new(),
        })
    }

    pub(crate) async fn subscribe<T>(&self, from_unit: Arc<&T>)
        where T: UnitLifecycle {
        let ctx = from_unit.get_context().unwrap();
        let ch = ctx.channel();
        self.base_unit.subscribe(ch, |row| {
            //ch.write(*row);
        });
        // let ch2 = ctx.get_channel();
        println!("print unit subscribe");
    }

    fn compute(row: &Row) {
        println!("{:?}", row);
    }
}

impl Default for PrintUnit {
    fn default() -> Self {
        PrintUnit {
            unit_config: Default::default(),
            base_unit: BaseUnit::new(),
        }
    }
}

impl ContextToolKit for PrintUnit {}

impl UnitLifecycle for PrintUnit {
    fn init(&mut self, ctx: UnitContext) {
        self.base_unit.init(ctx);
        // let x = ctx.channel();
        // let x1 = x.as_ref();
        // x1.subscribe(&RuntimeChannel::new("ss"));
        println!("initialize..");
    }

    fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.base_unit.start();
        Ok(())
    }
}

// =================================================================================================

/// Basic excel reader computing unit.
/// read data from specified excel (.xlsx, .xls)
///
/// # Examples
///
/// ```
/// ```
pub struct ExcelReaderUnit {
    // path of excel file
    path: String,
    // sheet name will be read
    sheet: String,
    // sheet index will be read
    sheet_idx: Option<i32>,
    // header name index
    header_idx: Option<i32>,
    // skip rows
    skip_rows: Option<i32>,
    // unit configuration
    unit_config: UnitConfig,
    // source unit
    base_unit: BaseUnit,
}

impl ExcelReaderUnit {
    fn set_path(&mut self, path: String) {
        self.path = path;
    }

    fn set_header_idx(&mut self, header_idx: i32) {
        self.header_idx = Some(header_idx);
    }
}

impl Default for ExcelReaderUnit {
    fn default() -> Self {
        ExcelReaderUnit {
            path: Default::default(),
            sheet: "Sheet1".to_string(),
            sheet_idx: None,
            header_idx: None,
            skip_rows: None,
            unit_config: UnitConfig::default(),
            base_unit: BaseUnit::new(),
        }
    }
}

impl Unit for ExcelReaderUnit {}

impl ContextToolKit for ExcelReaderUnit {}

impl UnitLifecycle for ExcelReaderUnit {
    fn init(&mut self, ctx: UnitContext) {
        self.base_unit.init(ctx);
    }

    /// Start the Excel reader computing unit, means read data from xls row by row.
    ///
    /// # Examples
    ///
    fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.base_unit.start();
        use calamine::{open_workbook, Reader, Xlsx};
        let mut excel: Xlsx<_> = open_workbook(&self.path)?;

        match self.sheet_idx {
            None => {
                if let Some(Ok(range)) = excel.worksheet_range(&self.sheet) {
                    let mut rows = range.rows();
                    let mut headers = vec![];
                    match self.header_idx {
                        Some(header_idx) => {
                            if let Some(header_columns) = rows.nth(header_idx as usize) {
                                for header in header_columns {
                                    headers.push(header.get_string().unwrap());
                                }
                            }
                        }
                        _ => {}
                    }

                    for columns in rows {
                        let proto_row = Row::with_field_names(columns, &headers);
                        self.write(self.base_unit.ctx(), proto_row)?;
                    }
                }
            }
            Some(sheet_idx) => {
                if let Some(Ok(r)) = excel.worksheet_range_at(sheet_idx as usize) {
                    for columns in r.rows() {
                        self.write(self.base_unit.ctx(), Row::from(columns))?;
                    }
                }
            }
        }

        Ok(())
    }

    fn get_context(&self) -> Result<&UnitContext, ()> {
        Ok(self.base_unit.ctx())
    }
}

#[tokio::test]
async fn test_excel_reader() -> Result<(), Box<dyn std::error::Error>> {
    let config_path_str = env!("CARGO_MANIFEST_DIR");
    let mut path = config_path_str.to_string();
    path.push_str("/resources/example_data_01.xlsx");

    let mut excel_reader_unit = ExcelReaderUnit::default();
    excel_reader_unit.set_path(path);
    excel_reader_unit.set_header_idx(0);

    let ctx = UnitContext::new_with_id("excel");
    excel_reader_unit.init(*ctx);


    let mut print_unit = PrintUnit::default();
    let print_ctx = UnitContext::new_with_id("printer");
    print_unit.init(*print_ctx);
    print_unit.subscribe(Arc::new(&excel_reader_unit)).await;

    let mut print_unit2 = PrintUnit::default();
    let print_ctx2 = UnitContext::new_with_id("printer2");
    print_unit2.init(*print_ctx2);
    print_unit2.subscribe(Arc::new(&excel_reader_unit)).await;

    // start read excel context from provided path
    excel_reader_unit.start()?;
    tokio::time::sleep(Duration::from_secs(1)).await;

    Ok(())
}


#[test]
fn test_print_unit() -> Result<(), Box<dyn std::error::Error>> {
    let mut unit = PrintUnit::new(Box::from(UnitConfig::new(r#"
print("hello lua: " .. math.max(1, 3, row.label2, 9, 3, 5))
print(2 + 1)
print(row.label1)
print(row.label1)
print(row.label2)
print(row.label1)
    "#)));

    let context = UnitContext::new();
    unit.init(*context);
    unit.start().expect("");

    let mut row = Row::new();
    // let mut vec = ;
    let mut column = Column::new();
    column.id = 1;
    column.field = "label1".to_string();
    column.str_val = "str_value_test".to_string();

    let mut column2 = Column::new();
    column2.id = 2;
    column2.field = "label2".to_string();
    column2.f64_val = 83.2255;
    column2.dt = EnumOrUnknown::new(DataType::f64);

    row.columns = vec![column, column2];
    //unit.calc(row, &context);

    Ok(())
}
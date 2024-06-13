use std::any::Any;
use std::fmt::{Debug, Formatter};
use std::ops::DerefMut;

use calamine::{DataType, Reader};

use crate::row::proto_row::{Column, Row};

impl From<&[DataType]> for Row {
    /// we transform [DataType] to [Row]
    ///
    /// # Examples
    ///
    /// ```
    /// use calamine::{open_workbook, Reader, Xlsx};
    /// let path = "<path_to_read>".to_string();
    /// let mut excel: Xlsx<_> = open_workbook(&path)?;
    ///
    /// if let Some(Ok(range)) = excel.worksheet_range("Sheet1") {
    ///     for columns in range.rows() {
    ///         println!("{:?}", Row::from(columns)?);
    ///     }
    /// }
    /// ```
    fn from(columns: &[DataType]) -> Self {
        let mut row = Row::default();
        for dt in columns {
            let mut column = Column::default();
            match dt {
                DataType::Int(v) => {
                    column.i64_val = *v;
                }
                DataType::Float(v) => {
                    column.f64_val = *v;
                }
                DataType::String(v) => {
                    column.str_val = v.to_string();
                }
                _ => {}
            }
            row.columns.push(column);
        }
        row
    }
}

impl Row {
    pub fn with_field_names(columns: &[DataType], names: &Vec<&str>) -> Self {
        let mut row = Row::default();
        let mut idx = 0;
        for dt in columns {
            let mut column = Column::default();
            match dt {
                DataType::Int(v) => {
                    column.i64_val = *v;
                }
                DataType::Float(v) => {
                    column.f64_val = *v;
                }
                DataType::String(v) => {
                    column.str_val = v.to_string();
                }
                _ => {}
            }

            if idx < names.len() {
                column.field = names[idx].to_string();
            }

            row.columns.push(column);
            idx = idx + 1;
        }
        row
    }
}

// impl From<Box<dyn ColumnValue>> for Vec<u8> {
//     fn from(value: Box<dyn ColumnValue>) -> Self {
//         todo!()
//     }
// }

// impl From<HashMap<String, Vec<u8>>> for Row {
//     fn from(value: HashMap<String, Vec<u8>>) -> Self {
//         let mut row: Row = Row::new();
//         let mut columns = Vec::new();
//         for (k, v) in value {
//             let mut column = Column::new();
//             column.id = k.into_bytes();
//             column.data = v;
//             columns.push(column);
//         }
//         row.columns = columns;
//         return row;
//     }
// }
//
// impl From<Row> for HashMap<String, Vec<u8>> {
//     fn from(value: Row) -> Self {
//         let mut map: HashMap<String, Vec<u8>> = HashMap::new();
//         for column in value.columns {
//            map.insert(String::from_utf8(column.label).unwrap(), column.data);
//         }
//         map
//     }
// }

// #[test]
// fn test_from() {
//     let mut row: Row = Row::new();
//     // let mut vec = ;
//     let mut column = Column::new();
//     column.id = Vec::from("1");
//     column.label = Vec::from("label1");
//     row.columns = vec![column];
//
//     let map2: HashMap<String, Vec<u8>> = row.into();
//     println!("{:?}", map2);
//
//     let mut row2: Row = map2.into();
//     println!("{:?}", row2);
// }
#[macro_use]
extern crate tantivy;

use std::io::BufReader;
use std::path::Path;

use tantivy::collector::TopDocs;
use tantivy::directory::MmapDirectory;
use tantivy::query::{FuzzyTermQuery, QueryParser};
use tantivy::schema::*;
use tantivy::Index;
use tantivy::ReloadPolicy;

/// https://tantivy-search.github.io/examples/basic_search.html
#[test]
fn test() -> tantivy::Result<()> {
    let index_path =
        Path::new("/Users/nigel/Workspace/code/nigel/RedisStudio/src-tauri/target/tantivy");
    let mut schema_builder = Schema::builder();
    schema_builder.add_text_field("title", TEXT | STORED);
    schema_builder.add_text_field("body", TEXT | STORED);

    // 指定索引所在的目录路径
    let index_path = "/Users/nigel/Workspace/code/nigel/RedisStudio/src-tauri/target/tantivy";

    // 创建一个 MmapDirectory 实例，用于访问索引文件
    let dir = MmapDirectory::open(index_path).unwrap_or_else(|e| {
        eprintln!("Error opening directory: {}", e);
        std::process::exit(1);
    });

    let schema = schema_builder.build();
    let index = Index::open_or_create(dir, schema.clone())?;
    // let mut index_writer = index.writer(50_000_000)?;

    let title = schema.get_field("title").unwrap();
    let body = schema.get_field("body").unwrap();

    let mut old_man_doc = Document::default();
    old_man_doc.add_text(title, "The Old Man and the Sea");
    old_man_doc.add_text(
        body,
        "He was an old man who fished alone in a skiff in the Gulf Stream and \
         he had gone eighty-four days now without taking a fish.",
    );

    // index_writer.add_document(old_man_doc);
    //
    // index_writer.add_document(doc!(
    // title => "Of Mice and Men",
    // body => "A few miles south of Soledad, the Salinas River drops in close to the hillside \
    //         bank and runs deep and green. The water is warm too, for it has slipped twinkling \
    //         over the yellow sands in the sunlight before reaching the narrow pool. On one \
    //         side of the river the golden foothill slopes curve up to the strong and rocky \
    //         Gabilan Mountains, but on the valley side the water is lined with trees—willows \
    //         fresh and green with every spring, carrying in their lower leaf junctures the \
    //         debris of the winter’s flooding; and sycamores with mottled, white, recumbent \
    //         limbs and branches that arch over the pool"
    // ));
    //
    // index_writer.add_document(doc!(
    // title => "Of Mice and Men",
    // body => "A few miles south of Soledad, the Salinas River drops in close to the hillside \
    //         bank and runs deep and green. The water is warm too, for it has slipped twinkling \
    //         over the yellow sands in the sunlight before reaching the narrow pool. On one \
    //         side of the river the golden foothill slopes curve up to the strong and rocky \
    //         Gabilan Mountains, but on the valley side the water is lined with trees—willows \
    //         fresh and green with every spring, carrying in their lower leaf junctures the \
    //         debris of the winter’s flooding; and sycamores with mottled, white, recumbent \
    //         limbs and branches that arch over the pool"
    // ));
    //
    // index_writer.add_document(doc!(
    // title => "The Modern Prometheus",
    // body => "You will rejoice to hear that no disaster has accompanied the commencement of an \
    //          enterprise which you have regarded with such evil forebodings.  I arrived here \
    //          yesterday, and my first task is to assure my dear sister of my welfare and \
    //          increasing confidence in the success of my undertaking."
    // ));
    //
    // index_writer.add_document(doc!(
    //     title => "商品数据",
    //     body => "*:GeneralCommodity:*"
    // ));

    // index_writer.commit()?;

    let reader = index
        .reader_builder()
        .reload_policy(ReloadPolicy::OnCommit)
        .try_into()?;

    let searcher = reader.searcher();

    let query_parser = QueryParser::for_index(&index, vec![title, body]);

    let query = query_parser.parse_query("fe")?;

    // let term = Term::from_field_text(body, "confid");
    // let query = FuzzyTermQuery::new(term, 0, true);

    let top_docs = searcher.search(&query, &TopDocs::with_limit(10))?;

    for (_score, doc_address) in top_docs {
        let retrieved_doc = searcher.doc(doc_address)?;
        println!("{}", schema.to_json(&retrieved_doc));
    }
    Ok(())
}

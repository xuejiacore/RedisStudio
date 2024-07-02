use redisstudio::indexer::simple_infer_pattern::PatternInferenceEngine;

#[test]
fn do_simple_test() {
    let mut inference = PatternInferenceEngine::new();
    inference.load_known_pattern(vec![
        r"\d+:commodity:\d+"
    ]);

    inference.infer("129:commodity:512");
    let mut tests = vec![
        "129:commodity:512",
    ];

    let mut generated_pattern = inference.infer_from_items(&tests);
    if let Some(pattern) = generated_pattern {
        println!("Generated Pattern: {}, by tests: {:?}", pattern, &tests);
    } else {
        println!("Not found any pattern by tests: {:?}", &tests);
    }

    tests.push("12x9:commodity:130");
    generated_pattern = inference.infer_from_items(&tests);
    if let Some(pattern) = generated_pattern {
        println!("Generated Pattern: {}, by tests: {:?}", pattern, &tests);
    } else {
        println!("Not found any pattern by tests: {:?}", &tests);
    }
}
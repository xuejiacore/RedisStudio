use redisstudio::indexer::simple_infer_pattern::PatternInferenceEngine;

#[test]
fn do_simple_test() {
    let mut inference = PatternInferenceEngine::new();
    inference.load_known_pattern(vec![
        (r"^[a-zA-Z0-9]+:commodity:\d+$", 0.5),
        (r"^\d+:commodity:\d+$", 0.2),
    ]);

    let mut tests = vec!["129:commodity:512"];

    let mut generated_pattern = inference.infer_from_items(&tests);
    if let Some(pattern) = generated_pattern {
        println!("Generated Pattern: {}, score {}, by tests: {:?}", pattern.recognized_pattern, pattern.score, &tests);
    } else {
        println!("Not found any pattern by tests: {:?}", &tests);
    }

    tests.push("12x9:commodity:130");
    generated_pattern = inference.infer_from_items(&tests);
    if let Some(pattern) = generated_pattern {
        println!("Generated Pattern: {}, score {}, by tests: {:?}", pattern.recognized_pattern, pattern.score, &tests);
    } else {
        println!("Not found any pattern by tests: {:?}", &tests);
    }
}

#[test]
fn test_direct_recognize() {
    let mut inference = PatternInferenceEngine::new();

    let mut test = vec!["129:commodity:331"];
    if let Some(pattern) = inference.infer_from_items(&test) {
        println!("Generated pattern: {}, score = {}", pattern.recognized_pattern, pattern.score);
    } else {
        println!("Not found any pattern by tests: {:?}", &test);
    }

    test.push("1341:commodity:3412");
    if let Some(pattern) = inference.infer_from_items(&test) {
        println!("Generated pattern: {}, score = {}", pattern.recognized_pattern, pattern.score);
    } else {
        println!("Not found any pattern by tests: {:?}", &test);
    }
}

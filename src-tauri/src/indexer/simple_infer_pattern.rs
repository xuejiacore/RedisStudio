use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    static ref NUMERIC_ALPHABETIC_PATTERN: Regex = Regex::new("[a-zA-Z0-9]+").unwrap();
    static ref NUM_ALPHA_UNDERLINE_PATTERN: Regex = Regex::new("[a-zA-Z0-9_-]+").unwrap();
    static ref YYYY_MM_DD_PATTERN: Regex = Regex::new(r"^\d{4}(-?)\d{2}\d{2}$").unwrap();
}

pub struct PatternInferenceEngine {
    known_patterns: Vec<Regex>,
}

impl PatternInferenceEngine {
    pub fn new() -> Self {
        PatternInferenceEngine {
            known_patterns: vec![]
        }
    }

    pub fn load_known_pattern(&mut self, known_patterns: Vec<&str>) {
        self.known_patterns = known_patterns.iter().map(|t| Regex::new(t))
            .filter(|p| p.is_ok())
            .map(|p| p.unwrap())
            .collect();
    }

    pub fn infer(&self, value: &str) {
        // 按照分隔符进行分割，寻找匹配度最高的模式
        println!("{}", value);
    }

    pub fn infer_from_items(&self, values: &Vec<&str>) -> Option<String> {
        if values.is_empty() || values.len() == 1 {
            return None;
        }
        let mut parts: Vec<Vec<&str>> = Vec::new();
        for s in &*values {
            let split: Vec<&str> = s.split(':').collect();
            parts.push(split);
        }

        use std::collections::HashSet;
        let mut regex_parts: Vec<String> = Vec::new();
        let mut contain_exactly_words = false;
        for i in 0..parts[0].len() {
            let mut unique_parts: HashSet<&str> = HashSet::new();
            for p in &parts {
                unique_parts.insert(p[i]);
            }

            if unique_parts.len() == 1 {
                contain_exactly_words = true;
                regex_parts.push(format!("{}", regex::escape(unique_parts.iter().next().unwrap())));
            } else if unique_parts.iter().all(|x| YYYY_MM_DD_PATTERN.is_match(x)) {
                regex_parts.push(r"^\d{4}(-?)\d{2}\1\d{2}$".to_string())
            } else if unique_parts.iter().all(|&x| x.chars().all(char::is_numeric)) {
                regex_parts.push(r"\d+".to_string());
            } else if unique_parts.iter().all(|&x| x.chars().all(char::is_alphabetic)) {
                regex_parts.push("[a-zA-Z]+".to_string());
            } else if unique_parts.iter().all(|&x| NUMERIC_ALPHABETIC_PATTERN.is_match(x)) {
                regex_parts.push("[a-zA-Z0-9]+".to_string())
            } else if unique_parts.iter().all(|&x| NUM_ALPHA_UNDERLINE_PATTERN.is_match(x)) {
                regex_parts.push("[a-zA-Z0-9_-]+".to_string())
            } else {
                regex_parts.push("[^:]+".to_string());
            }
        }

        if contain_exactly_words {
            Some(regex_parts.join(":"))
        } else {
            None
        }
    }
}


use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    static ref NUMERIC_ALPHABETIC_PATTERN: Regex = Regex::new("[a-zA-Z0-9]+").unwrap();
    static ref NUM_ALPHA_UNDERLINE_PATTERN: Regex = Regex::new("[a-zA-Z0-9_-]+").unwrap();
    static ref YYYY_MM_DD_PATTERN: Regex = Regex::new(r"^\d{4}(-?)\d{2}\d{2}$").unwrap();
}

pub struct PatternInferenceEngine {
    known_patterns: Vec<(Regex, f32)>,
}

pub struct InferResult {
    pub recognized_pattern: String,
    pub score: f32,
}

impl InferResult {
    fn new(recognized_pattern: String, priority: f32) -> Self {
        Self {
            recognized_pattern,
            score: priority,
        }
    }

    fn from_known_patterns(known_pattern: &(Regex, f32)) -> Self {
        Self {
            recognized_pattern: known_pattern.0.to_string(),
            score: known_pattern.1,
        }
    }
}

impl PatternInferenceEngine {
    pub fn new() -> Self {
        PatternInferenceEngine {
            known_patterns: vec![],
        }
    }

    pub fn load_known_pattern(&mut self, known_patterns: Vec<(&str, f32)>) {
        self.known_patterns = known_patterns
            .iter()
            .map(|t| (Regex::new(t.0), t.1))
            .filter(|p| p.0.is_ok())
            .map(|p| (p.0.unwrap(), p.1))
            .collect();
        self.known_patterns.sort_by(|a,b| a.1.total_cmp(&b.1))
    }

    pub fn infer_from_items(&self, values: &Vec<&str>) -> Option<InferResult> {
        if values.is_empty() || values.len() == 1 {
            let find_result = self.known_patterns.iter().find(|t| {
                return values.iter().all(|v| (*t).clone().0.is_match(v));
            });
            if find_result.is_some() {
                let reg = find_result?;
                return Some(InferResult::from_known_patterns(reg));
            }
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
        let mut recognized_score = 0f32;
        for i in 0..parts[0].len() {
            let mut unique_parts: HashSet<&str> = HashSet::new();
            for p in &parts {
                unique_parts.insert(p[i]);
            }

            if unique_parts.len() == 1 {
                contain_exactly_words = true;
                regex_parts.push(format!(
                    "{}",
                    regex::escape(unique_parts.iter().next().unwrap())
                ));
            } else if unique_parts.iter().all(|x| YYYY_MM_DD_PATTERN.is_match(x)) {
                regex_parts.push(r"^\d{4}(-?)\d{2}\1\d{2}$".to_string());
                recognized_score += 0.2f32;
            } else if unique_parts
                .iter()
                .all(|&x| x.chars().all(char::is_numeric))
            {
                regex_parts.push(r"\d+".to_string());
                recognized_score += 0.1f32;
            } else if unique_parts
                .iter()
                .all(|&x| x.chars().all(char::is_alphabetic))
            {
                regex_parts.push("[a-zA-Z]+".to_string());
                recognized_score += 0.3f32;
            } else if unique_parts
                .iter()
                .all(|&x| NUMERIC_ALPHABETIC_PATTERN.is_match(x))
            {
                regex_parts.push("[a-zA-Z0-9]+".to_string());
                recognized_score += 0.4f32;
            } else if unique_parts
                .iter()
                .all(|&x| NUM_ALPHA_UNDERLINE_PATTERN.is_match(x))
            {
                regex_parts.push("[a-zA-Z0-9_-]+".to_string());
                recognized_score += 0.5f32;
            } else {
                regex_parts.push("[^:]+".to_string());
            }
        }

        if contain_exactly_words {
            Some(InferResult::new(regex_parts.join(":"), recognized_score))
        } else {
            None
        }
    }
}

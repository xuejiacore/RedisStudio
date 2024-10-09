use lazy_static::lazy_static;
use regex::Regex;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub const REGX_NUMERIC: &str = r"\d+";
pub const REGX_DATE: &str = r"([0-9]{3}[1-9]|[0-9]{2}[1-9][0-9]{1}|[0-9]{1}[1-9][0-9]{2}|[1-9][0-9]{3})-?((0[13578]|1[02])-?(0[1-9]|[12][0-9]|3[01])|(0[469]|11)-?(0[1-9]|[12][0-9]|30)|02-?(0[1-9]|1[0-9]|2[0-8])|(02-?29))";
pub const REGX_ALPHABET: &str = "[a-zA-Z]+";
pub const REGX_ALPHABET_NUM: &str = "[a-zA-Z0-9]+";
pub const REGX_ALPHABET_NUM_BAR: &str = "[a-zA-Z0-9_-]+";

lazy_static! {
    static ref NUMERIC_ALPHABETIC_PATTERN: Regex = Regex::new("^[a-zA-Z0-9]+$").unwrap();
    static ref NUM_ALPHA_UNDERLINE_PATTERN: Regex = Regex::new("^[a-zA-Z0-9_-]+$").unwrap();
    static ref YYYY_MM_DD_PATTERN: Regex = Regex::new(r"^([0-9]{3}[1-9]|[0-9]{2}[1-9][0-9]{1}|[0-9]{1}[1-9][0-9]{2}|[1-9][0-9]{3})-?((0[13578]|1[02])-?(0[1-9]|[12][0-9]|3[01])|(0[469]|11)-?(0[1-9]|[12][0-9]|30)|02-?(0[1-9]|1[0-9]|2[0-8])|(02-?29))$").unwrap();
}

/// manager of pattern inference engines.
#[derive(Clone)]
pub struct PatternInferenceEngines {
    pub datasource_pattern: Arc<Mutex<HashMap<String, PatternInferenceEngine>>>,
}

impl PatternInferenceEngines {
    pub fn new() -> Self {
        PatternInferenceEngines {
            datasource_pattern: Arc::new(Mutex::new(HashMap::new()))
        }
    }
}

#[derive(Clone)]
pub struct PatternInferenceEngine {
    known_patterns: Arc<Mutex<Vec<(Regex, f32)>>>,
}

#[derive(Debug)]
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

    /// Converts the given value to a normalized pattern
    ///
    /// # Examples
    ///
    /// ```
    /// use redisstudio::indexer::simple_infer_pattern::InferResult;
    /// let infer_result: InferResult; // todo:
    /// let pattern1 = r"^\d+:commodity:\d+$";
    /// let normalized_pattern1 = infer_result.normalized();
    /// assert_eq!(normalized_pattern1, "*:commodity:*");
    /// ```
    pub fn normalized(&self) -> String {
        let placeholder = vec![
            REGX_NUMERIC,
            REGX_DATE,
            REGX_ALPHABET,
            REGX_ALPHABET_NUM,
            REGX_ALPHABET_NUM_BAR];
        let mut tmp = self.recognized_pattern.clone();
        let wildcard = "*";
        for p in placeholder {
            tmp = tmp.replace(p, wildcard);
        }
        tmp.remove(0);
        tmp.remove(tmp.len() - 1);
        tmp
    }
}

impl PatternInferenceEngine {
    pub fn new() -> Self {
        PatternInferenceEngine {
            known_patterns: Arc::new(Mutex::new(vec![])),
        }
    }

    pub fn load_known_pattern(&mut self, known_patterns: Vec<(String, f32)>) {
        let mut patterns = self.known_patterns.lock().unwrap();
        let mut tmp: Vec<(Regex, f32)> = known_patterns
            .iter()
            .map(|t| (Regex::new(t.0.as_str()), t.1))
            .filter(|p| p.0.is_ok())
            .map(|p| (p.0.unwrap(), p.1))
            .collect();
        patterns.append(&mut tmp);
        (*patterns).sort_by(|a, b| a.1.total_cmp(&b.1))
    }

    pub fn add_known_pattern(&mut self, pattern: (Regex, f32)) {
        let mut patterns = self.known_patterns.lock().unwrap();
        patterns.push(pattern);
        // TODO: optimize
        (*patterns).sort_by(|a, b| a.1.total_cmp(&b.1))
    }

    pub fn infer_from_items(&self, values: &Vec<String>) -> Option<InferResult> {
        if values.is_empty() || values.len() == 1 {
            let patterns = self.known_patterns.lock().unwrap();
            let find_result = patterns.iter().find(|t| {
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
                if parts[0][i].parse::<i32>().is_err() {
                    contain_exactly_words = true;
                    regex_parts.push(format!("{}", regex::escape(unique_parts.iter().next().unwrap())));
                } else {
                    regex_parts.push(REGX_NUMERIC.to_string());
                    recognized_score += 0.1;
                }
            } else if unique_parts.iter().all(|x| YYYY_MM_DD_PATTERN.is_match(x)) {
                regex_parts.push(REGX_DATE.to_string());
                recognized_score += 0.2;
            } else if unique_parts.iter().all(|&x| x.chars().all(char::is_numeric)) {
                regex_parts.push(REGX_NUMERIC.to_string());
                recognized_score += 0.1;
            } else if unique_parts.iter().all(|&x| x.chars().all(char::is_alphabetic)) {
                regex_parts.push(REGX_ALPHABET.to_string());
                recognized_score += 0.3;
            } else if unique_parts.iter().all(|&x| NUMERIC_ALPHABETIC_PATTERN.is_match(x)) {
                regex_parts.push(REGX_ALPHABET_NUM.to_string());
                recognized_score += 0.4;
            } else if unique_parts.iter().all(|&x| NUM_ALPHA_UNDERLINE_PATTERN.is_match(x)) {
                regex_parts.push(REGX_ALPHABET_NUM_BAR.to_string());
                recognized_score += 0.5;
            } else {
                regex_parts.push("[^:]+".to_string());
            }
        }

        if contain_exactly_words {
            let mut pattern_str = regex_parts.join(":");
            pattern_str.insert(0, '^');
            pattern_str.push('$');
            Some(InferResult::new(pattern_str, recognized_score))
        } else {
            None
        }
    }
}

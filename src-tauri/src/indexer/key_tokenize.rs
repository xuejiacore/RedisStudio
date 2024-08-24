use tantivy::tokenizer::{Token, TokenStream, Tokenizer};
#[derive(Clone)]
pub struct RedisKeyTokenizer;

impl Tokenizer for RedisKeyTokenizer {
    type TokenStream<'a> = Box<dyn TokenStream + 'a>; // Use Box<dyn TokenStream>

    fn token_stream<'a>(&mut self, text: &'a str) -> Self::TokenStream<'a> {
        let tokens = text
            .split(':')
            .enumerate()
            .map(|(i, token)| Token {
                offset_from: i,
                offset_to: i + token.len(),
                position: i,
                text: token.to_string(),
                position_length: 1,
            })
            .collect::<Vec<_>>();

        Box::new(CustomTokenStream { tokens, index: 0 }) as Self::TokenStream<'a>
    }
}


struct CustomTokenStream {
    tokens: Vec<Token>,
    index: usize,
}

impl TokenStream for CustomTokenStream {
    fn advance(&mut self) -> bool {
        if self.index < self.tokens.len() {
            self.index += 1;
            true
        } else {
            false
        }
    }

    fn token(&self) -> &Token {
        &self.tokens[self.index - 1]
    }

    fn token_mut(&mut self) -> &mut Token {
        &mut self.tokens[self.index - 1]
    }
}
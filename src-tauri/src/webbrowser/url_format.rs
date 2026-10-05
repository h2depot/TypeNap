// Base URL and query parameter. Build queries with Url::query_pairs_mut()
// so search terms are URL-encoded correctly.
pub const GOOGLE: (&str, &str) = ("https://www.google.com/search", "q");
pub const BING: (&str, &str) = ("https://www.bing.com/search", "q");
pub const DUCKDUCKGO: (&str, &str) = ("https://duckduckgo.com/", "q");
pub const YAHOO: (&str, &str) = ("https://search.yahoo.com/search", "p");

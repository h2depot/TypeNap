use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct TxtInfo {
    pub(crate) story_name: String,
    pub(crate) title: String,
}

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContentType {
    Txt,
    Character,
    World,
    Entity,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContentsInfo {
    pub(crate) story_name: String,
    pub(crate) name: String,
    pub(crate) access_id: String,
    pub(crate) content_type: ContentType,
}

#[derive(Deserialize)]
pub struct CreateContentsInput {
    pub(crate) story_name: String,
    pub(crate) name: String,
    pub(crate) content_type: ContentType,
}

impl ContentType {
    pub fn prefix(self) -> &'static str {
        match self {
            Self::Txt => "text",
            Self::Character => "character",
            Self::World => "world",
            Self::Entity => "entity",
        }
    }

    pub fn extension(self) -> &'static str {
        if self == Self::Txt {
            "txt"
        } else {
            "json"
        }
    }
}

impl ContentsInfo {
    pub fn require_type(&self, expected: ContentType) -> Result<(), String> {
        if self.content_type != expected {
            return Err("Unexpected content type".into());
        }
        Ok(())
    }
}

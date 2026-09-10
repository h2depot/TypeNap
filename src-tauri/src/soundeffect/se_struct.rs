use std::sync::Arc;

#[allow(dead_code)]
#[derive(Clone)]
pub struct SoundEffectCache {
    pub samples: Arc<[f32]>,
    /// x[n] * (1 - sin(2π * am_frequency_hz * t)) / 2, precomputed at load time.
    pub modulation_samples: Arc<[f32]>,
    pub sample_rate: u32,
    pub channels: u32,
}

#[allow(dead_code)]
pub struct SoundEffectData {
    /// Frequency chosen from local time once for all samples in this theme.
    pub am_frequency_hz: f64,
    pub sound: [SoundEffectCache; 4],
    pub enter_sound: SoundEffectCache,
}

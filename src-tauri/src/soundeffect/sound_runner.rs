use super::se_struct::{SoundEffectCache, SoundEffectData};
use super::signal_processor::SignalProcessor;
use rodio::buffer::SamplesBuffer;
use rodio::{DeviceSinkBuilder, MixerDeviceSink};
use std::num::{NonZeroU16, NonZeroU32};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

struct SoundPlayer {
    sink: Option<MixerDeviceSink>,
    sound_data: Option<SoundEffectData>,
    processor: SignalProcessor,
    last_key_time: Option<Instant>,
}

impl SoundPlayer {
    fn new() -> Self {
        let sink = DeviceSinkBuilder::open_default_sink()
            .map_err(|e| {
                eprintln!("Failed to open default audio device: {}", e);
            })
            .ok();
        Self {
            sink,
            sound_data: None,
            processor: SignalProcessor::default(),
            last_key_time: None,
        }
    }

    fn play_cache(&mut self, cache: &SoundEffectCache) -> Result<(), String> {
        let Some(sink) = self.sink.as_ref() else {
            return Ok(());
        };
        let channels = u16::try_from(cache.channels)
            .ok()
            .and_then(NonZeroU16::new)
            .ok_or("Invalid sound channel count")?;
        let sample_rate = NonZeroU32::new(cache.sample_rate).ok_or("Invalid sound sample rate")?;
        let now = Instant::now();
        let timeinterval = self
            .last_key_time
            .map(|previous| now.duration_since(previous));
        self.last_key_time = Some(now);
        let samples = self.processor.process_signal(cache, timeinterval);
        // The mixer plays asynchronously. Update the EMA and enqueue under one
        // lock so per-key worker threads cannot reorder the envelope updates.
        sink.mixer()
            .add(SamplesBuffer::new(channels, sample_rate, samples));
        Ok(())
    }
}

static PLAYER: OnceLock<Mutex<SoundPlayer>> = OnceLock::new();
static RNG_STATE: AtomicU64 = AtomicU64::new(0);

fn get_player() -> &'static Mutex<SoundPlayer> {
    PLAYER.get_or_init(|| Mutex::new(SoundPlayer::new()))
}

fn get_random_index() -> usize {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    let prev = RNG_STATE.load(Ordering::Relaxed);
    let mut x = prev.wrapping_add(now).wrapping_add(0x9E3779B97F4A7C15);
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    RNG_STATE.store(x, Ordering::Relaxed);
    (x % 4) as usize
}

pub fn set_sound_data(data: SoundEffectData) -> Result<(), String> {
    let mut player = get_player().lock().map_err(|e| e.to_string())?;
    player.sound_data = Some(data);
    player.processor = SignalProcessor::default();
    player.last_key_time = None;
    Ok(())
}

pub fn play_sound() -> Result<(), String> {
    play(false)
}

pub fn play_enter_sound() -> Result<(), String> {
    play(true)
}

fn play(enter: bool) -> Result<(), String> {
    let mut player = get_player().lock().map_err(|e| e.to_string())?;
    let cache = player.sound_data.as_ref().map(|data| {
        if enter {
            data.enter_sound.clone()
        } else {
            data.sound[get_random_index()].clone()
        }
    });
    if let Some(cache) = cache {
        player.play_cache(&cache)?;
    }
    Ok(())
}

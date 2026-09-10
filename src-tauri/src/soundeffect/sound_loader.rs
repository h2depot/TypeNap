use super::se_struct::{SoundEffectCache, SoundEffectData};
use super::signal_processor::{am_frequency_for_hour, precompute_modulation};
use crate::utils::time_manager;
use rodio::cpal::Sample;
use rodio::{Decoder, Source};
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::Arc;

fn load_cache_from_wav(file_path: &Path, am_frequency_hz: f64) -> Result<SoundEffectCache, String> {
    let file =
        File::open(file_path).map_err(|e| format!("Failed to open {:?}: {}", file_path, e))?;
    let reader = BufReader::new(file);
    let decoder =
        Decoder::new(reader).map_err(|e| format!("Failed to decode {:?}: {}", file_path, e))?;

    let sample_rate = decoder.sample_rate().get();
    let channels = decoder.channels().get() as u32;
    let samples: Vec<f32> = decoder.map(|s| s.to_float_sample()).collect();

    Ok(SoundEffectCache {
        modulation_samples: precompute_modulation(&samples, sample_rate, channels, am_frequency_hz)
            .into(),
        samples: Arc::from(samples.into_boxed_slice()),
        sample_rate,
        channels,
    })
}

fn resolve_theme_dir(se_theme: &str) -> (PathBuf, String) {
    let lower = se_theme.to_lowercase();
    let normalized = match lower.as_str() {
        "chillwood" | "casualwood" => "casualwood",
        "raindrop" => "raindrop",
        "typewriter" => "typewriter",
        other => other,
    };
    let prefix = normalized.to_string();

    let candidates = [
        PathBuf::from("sound_assets").join(normalized),
        PathBuf::from("src-tauri")
            .join("sound_assets")
            .join(normalized),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return (candidate.clone(), prefix);
        }
    }

    // 実行可能ファイル相対の探索 (target/debug, target/release など)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let exe_candidate = exe_dir.join("sound_assets").join(normalized);
            if exe_candidate.exists() {
                return (exe_candidate, prefix);
            }
        }
    }

    (candidates[0].clone(), prefix)
}

pub fn load_wavfile(se_theme: String) -> Result<SoundEffectData, String> {
    let am_frequency_hz = am_frequency_for_hour(time_manager::current_local_hour());
    let (theme_dir, prefix) = resolve_theme_dir(&se_theme);

    let rnd1 = load_cache_from_wav(
        &theme_dir.join(format!("{}_rnd_1.wav", prefix)),
        am_frequency_hz,
    )?;
    let rnd2 = load_cache_from_wav(
        &theme_dir.join(format!("{}_rnd_2.wav", prefix)),
        am_frequency_hz,
    )?;
    let rnd3 = load_cache_from_wav(
        &theme_dir.join(format!("{}_rnd_3.wav", prefix)),
        am_frequency_hz,
    )?;
    let rnd4 = load_cache_from_wav(
        &theme_dir.join(format!("{}_rnd_4.wav", prefix)),
        am_frequency_hz,
    )?;
    let enter_sound = load_cache_from_wav(
        &theme_dir.join(format!("{}_enter.wav", prefix)),
        am_frequency_hz,
    )?;

    Ok(SoundEffectData {
        am_frequency_hz,
        sound: [rnd1, rnd2, rnd3, rnd4],
        enter_sound,
    })
}

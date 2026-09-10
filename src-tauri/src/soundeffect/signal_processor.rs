use super::se_struct::SoundEffectCache;
use std::time::Duration;

const MIN_AM_FREQUENCY_HZ: f64 = 14.0;
const MAX_AM_FREQUENCY_HZ: f64 = 18.0;
const PEAK_ACTIVITY_HOUR: f64 = 15.0;
const EMA_ALPHA: f64 = 0.2;
const FAST_INTERVAL_SECONDS: f64 = 0.080;
const SLOW_INTERVAL_SECONDS: f64 = 0.500;
const REFERENCE_INTERVAL_SECONDS: f64 = 0.250;
const ATTACK_SECONDS: f64 = 180.0;
const RECOVERY_SECONDS: f64 = 180.0;
const MIN_VOLUME: f32 = 0.8;
const MAX_VOLUME: f32 = 1.2;
const MIN_DEPTH: f32 = 0.3;
const MAX_DEPTH: f32 = 0.7;

/// Shared by normal keys and Enter; reset when loading a theme.
pub struct SignalProcessor {
    interval_ema: f64,
    progress: f64,
}

impl Default for SignalProcessor {
    fn default() -> Self {
        Self {
            interval_ema: SLOW_INTERVAL_SECONDS,
            progress: 0.0,
        }
    }
}

impl SignalProcessor {
    /// `None` is the first key: volume 1.2, depth 0.3.
    fn parameters(&mut self, timeinterval: Option<Duration>) -> (f32, f32) {
        if let Some(interval) = timeinterval {
            let seconds = interval.as_secs_f64();
            if seconds >= RECOVERY_SECONDS {
                // Apply elapsed idle time before playing the first resumed key.
                // No timer is needed while silent, and this key stays at baseline.
                *self = Self::default();
            } else {
                self.interval_ema += EMA_ALPHA
                    * (seconds.clamp(FAST_INTERVAL_SECONDS, SLOW_INTERVAL_SECONDS)
                        - self.interval_ema);
                if seconds <= SLOW_INTERVAL_SECONDS {
                    let pace = ((SLOW_INTERVAL_SECONDS - self.interval_ema)
                        / (SLOW_INTERVAL_SECONDS - REFERENCE_INTERVAL_SECONDS))
                        .clamp(0.0, 1.0);
                    // 720 intervals at 4 keys/sec take 3 minutes. The interval
                    // EMA adds about four warm-up keys before full attack speed.
                    self.progress += pace * REFERENCE_INTERVAL_SECONDS / ATTACK_SECONDS;
                } else {
                    // Ordinary typing gaps <= 500 ms do not count as rest.
                    // From full progress, 180 seconds of rest returns to zero.
                    self.progress -= (seconds - SLOW_INTERVAL_SECONDS)
                        / (RECOVERY_SECONDS - SLOW_INTERVAL_SECONDS);
                }
                self.progress = self.progress.clamp(0.0, 1.0);
            }
        }
        // Smoothstep is a bounded sigmoid-like curve with exact endpoints and
        // zero slope at both ends: slow start, faster middle, gentle finish.
        let activity = (self.progress * self.progress * (3.0 - 2.0 * self.progress)) as f32;
        (
            MAX_VOLUME - (MAX_VOLUME - MIN_VOLUME) * activity,
            MIN_DEPTH + (MAX_DEPTH - MIN_DEPTH) * activity,
        )
    }

    pub fn process_signal(
        &mut self,
        cache: &SoundEffectCache,
        timeinterval: Option<Duration>,
    ) -> Vec<f32> {
        let (volume, depth) = self.parameters(timeinterval);
        // y[n] = Vol * (x[n] - D * x[n] * core[n]). Apply volume exactly once.
        cache
            .samples
            .iter()
            .zip(cache.modulation_samples.iter())
            .map(|(&sample, &modulation)| volume * (sample - depth * modulation))
            .collect()
    }
}

/// Smooth 24-hour cycle: 14 Hz at 03:00, 18 Hz at 15:00.
/// This is an audio design curve, not an estimate of the user's actual activity.
pub fn am_frequency_for_hour(local_hour: f64) -> f64 {
    let phase = std::f64::consts::TAU * (local_hour.rem_euclid(24.0) - PEAK_ACTIVITY_HOUR) / 24.0;
    let activity = (1.0 + phase.cos()) * 0.5;
    MIN_AM_FREQUENCY_HZ + (MAX_AM_FREQUENCY_HZ - MIN_AM_FREQUENCY_HZ) * activity
}

pub fn precompute_modulation(
    samples: &[f32],
    sample_rate: u32,
    channels: u32,
    am_frequency_hz: f64,
) -> Vec<f32> {
    samples
        .iter()
        .enumerate()
        .map(|(index, &sample)| {
            // Interleaved channels in the same frame must have the same phase.
            let time = (index / channels as usize) as f64 / sample_rate as f64;
            let core = (1.0 - (std::f64::consts::TAU * am_frequency_hz * time).sin()) * 0.5;
            sample * core as f32
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn activity(parameters: (f32, f32)) -> f32 {
        (parameters.1 - MIN_DEPTH) / (MAX_DEPTH - MIN_DEPTH)
    }

    #[test]
    fn four_keys_per_second_reach_the_far_end_in_three_minutes() {
        let mut processor = SignalProcessor::default();
        assert_eq!(processor.parameters(None), (MAX_VOLUME, MIN_DEPTH));
        let mut previous = 0.0;
        for key in 1..=720 {
            let parameters = processor.parameters(Some(Duration::from_millis(250)));
            let current = activity(parameters);
            assert!(current >= previous);
            assert!((MIN_VOLUME..=MAX_VOLUME).contains(&parameters.0));
            assert!((MIN_DEPTH..=MAX_DEPTH).contains(&parameters.1));
            match key {
                240 => assert!((current - 0.26).abs() < 0.02),
                480 => assert!((current - 0.74).abs() < 0.02),
                720 => assert!(current > 0.999),
                _ => {}
            }
            previous = current;
        }
        for _ in 0..720 {
            processor.parameters(Some(Duration::from_millis(250)));
        }
        assert_eq!(
            processor.parameters(Some(Duration::ZERO)),
            (MIN_VOLUME, MAX_DEPTH)
        );
    }

    #[test]
    fn rest_follows_an_s_curve_and_resumed_key_is_reset_after_three_minutes() {
        let mut previous = 1.0;
        for seconds in 0..=180 {
            // Each case is one uninterrupted pause from full activity.
            let mut processor = SignalProcessor {
                interval_ema: REFERENCE_INTERVAL_SECONDS,
                progress: 1.0,
            };
            let current = activity(processor.parameters(Some(Duration::from_secs(seconds))));
            assert!(current <= previous);
            match seconds {
                60 => assert!((current - 0.74).abs() < 0.01),
                90 => assert!((current - 0.50).abs() < 0.01),
                120 => assert!((current - 0.26).abs() < 0.01),
                180 => assert_eq!(current, 0.0),
                _ => {}
            }
            previous = current;
        }
        for progress in [0.2, 0.5, 1.0] {
            for seconds in [180, 600] {
                let mut processor = SignalProcessor {
                    interval_ema: FAST_INTERVAL_SECONDS,
                    progress,
                };
                assert_eq!(
                    processor.parameters(Some(Duration::from_secs(seconds))),
                    (MAX_VOLUME, MIN_DEPTH)
                );
                assert_eq!(processor.interval_ema, SLOW_INTERVAL_SECONDS);
                let next = activity(processor.parameters(Some(Duration::from_millis(250))));
                assert!(next < 0.001);
            }
        }
    }

    #[test]
    fn slower_typing_accumulates_less_and_pauses_reduce_activity() {
        let mut regular = SignalProcessor::default();
        let mut slow = SignalProcessor::default();
        for _ in 0..450 {
            regular.parameters(Some(Duration::from_millis(250)));
            slow.parameters(Some(Duration::from_millis(400)));
        }
        assert!(slow.progress < regular.progress);
        let before = regular.progress;
        regular.parameters(Some(Duration::from_secs(30)));
        assert!(regular.progress < before);
        let mut baseline = SignalProcessor::default();
        assert_eq!(
            baseline.parameters(Some(Duration::from_secs(1))),
            (MAX_VOLUME, MIN_DEPTH)
        );
    }
}

use battery::{Manager, State};
use serde::Serialize;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const BATTERY_LOW_EVENT: &str = "battery-low";
// The threshold below which the battery is considered low (10%).
const LOW_BATTERY_THRESHOLD: f32 = 0.10;
const POLL_INTERVAL: Duration = Duration::from_secs(60);

#[derive(Clone, Serialize)]
// Payroad for the "battery-low" event emitted to the frontend.
struct BatteryLowPayload {
    level: f32,
}

#[derive(Clone, Copy)]
// Snapshot of the battery status at a given time.
// Reference: https://docs.rs/battery/0.7.8/battery/struct.Battery.html#method.state_of_charge
// Reference: https://docs.rs/battery/0.7.8/battery/struct.Battery.html#method.state
struct BatteryStatus {
    level: f32,
    state: State,
}

pub fn start_battery_monitor(app_handle: AppHandle) {
    thread::Builder::new()
        .name("battery-monitor".into())
        .spawn(move || run_battery_monitor(app_handle))
        .expect("failed to spawn battery monitor thread");
}

fn run_battery_monitor(app_handle: AppHandle) {
    let Ok(manager) = Manager::new() else {
        return;
    };

    let mut has_emitted_low_battery = false;

    loop {
        if let Some(status) = read_primary_battery_status(&manager) {
            if should_emit_low_battery(status, has_emitted_low_battery) {
                let _ = app_handle.emit(
                    BATTERY_LOW_EVENT,
                    BatteryLowPayload {
                        level: status.level,
                    },
                );
                has_emitted_low_battery = true;
            } else if should_reset_low_battery(status) {
                has_emitted_low_battery = false;
            }
        }

        thread::sleep(POLL_INTERVAL);
    }
}

fn read_primary_battery_status(manager: &Manager) -> Option<BatteryStatus> {
    let mut batteries = manager.batteries().ok()?;
    let battery = batteries.next()?.ok()?;

    Some(BatteryStatus {
        level: battery.state_of_charge().value,
        state: battery.state(),
    })
}

fn should_emit_low_battery(status: BatteryStatus, already_emitted: bool) -> bool {
    !already_emitted
        && status.level < LOW_BATTERY_THRESHOLD
        && !matches!(status.state, State::Charging | State::Full)
}

fn should_reset_low_battery(status: BatteryStatus) -> bool {
    status.level >= LOW_BATTERY_THRESHOLD || matches!(status.state, State::Charging | State::Full)
}

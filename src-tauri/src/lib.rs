use base64::Engine;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;
use rfd::FileDialog;
use serde::Serialize;
use std::path::{Path, PathBuf};
use url::Url;
use walkdir::WalkDir;

#[derive(Serialize)]
struct TrackMeta {
  path: String,
  title: Option<String>,
  artist: Option<String>,
  album: Option<String>,
  year: Option<i32>,
  duration: Option<f64>,
}

fn is_audio_path(path: &Path) -> bool {
  match path.extension().and_then(|s| s.to_str()) {
    Some(ext) => matches!(ext.to_ascii_lowercase().as_str(), "mp3" | "flac" | "ogg" | "wav" | "aac" | "m4a" | "opus" | "wma" | "mp4"),
    None => false,
  }
}

fn normalize_mime(mime: Option<&str>) -> &'static str {
  let m = mime.unwrap_or("").to_ascii_lowercase();
  if m.contains("png") { return "image/png"; }
  if m.contains("webp") { return "image/webp"; }
  if m.contains("gif") { return "image/gif"; }
  "image/jpeg"
}

#[tauri::command]
fn dialog_open_files() -> Vec<String> {
  FileDialog::new()
    .add_filter("Audio", &["mp3", "flac", "ogg", "wav", "aac", "m4a", "opus", "wma", "mp4"])
    .pick_files()
    .unwrap_or_default()
    .into_iter()
    .map(|p| p.to_string_lossy().to_string())
    .collect()
}

#[tauri::command]
fn dialog_open_folder() -> Vec<String> {
  let Some(folder) = FileDialog::new().pick_folder() else {
    return vec![];
  };

  let mut out: Vec<String> = WalkDir::new(folder)
    .into_iter()
    .filter_map(Result::ok)
    .filter(|e| e.file_type().is_file())
    .map(|e| e.into_path())
    .filter(|p| is_audio_path(p))
    .map(|p| p.to_string_lossy().to_string())
    .collect();

  out.sort();
  out
}

#[tauri::command]
fn media_read_tags(paths: Vec<String>) -> Vec<TrackMeta> {
  paths
    .into_iter()
    .map(|raw| {
      let path = PathBuf::from(&raw);
      let mut out = TrackMeta {
        path: raw.clone(),
        title: None,
        artist: None,
        album: None,
        year: None,
        duration: None,
      };

      if let Ok(tagged) = Probe::open(&path).and_then(|p| p.read()) {
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
          out.title = tag.title().map(|s| s.to_string());
          out.artist = tag.artist().map(|s| s.to_string());
          out.album = tag.album().map(|s| s.to_string());
          out.year = tag.year().map(|y| y as i32);
        }
        out.duration = Some(tagged.properties().duration().as_secs_f64());
      }

      out
    })
    .collect()
}

#[tauri::command]
fn media_read_cover(path: String) -> Option<String> {
  let tagged = Probe::open(Path::new(&path)).and_then(|p| p.read()).ok()?;
  let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
  let pic = tag.pictures().first()?;
  let mime = normalize_mime(pic.mime_type().map(|m| m.as_str()));
  let b64 = base64::engine::general_purpose::STANDARD.encode(pic.data());
  Some(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn media_to_file_url(path: String) -> Option<String> {
  Url::from_file_path(path).ok().map(|u| u.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      dialog_open_files,
      dialog_open_folder,
      media_read_tags,
      media_read_cover,
      media_to_file_url
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

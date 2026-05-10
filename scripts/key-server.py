#!/usr/bin/env python3
import tempfile
import os
import subprocess
import shutil
import threading
from flask import Flask, request, jsonify, send_file
import numpy as np

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

app = Flask(__name__)
_demucs_lock = threading.Semaphore(1)

# Musically correct tonic name per scale type
# Major keys: use flat spelling for Eb, Ab, Bb major; sharp for C#, F# major
# Minor keys: use sharp spelling for C#, D#, F#, G#, A# minor; flat for Eb, Ab, Bb minor is uncommon
MAJOR_KEY_NAMES = ["C", "C#", "D", "E♭", "E", "F", "F#", "G", "A♭", "A", "B♭", "B"]
MINOR_KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "B♭", "B"]

def key_name(index, scale):
    return MAJOR_KEY_NAMES[index] if scale == "major" else MINOR_KEY_NAMES[index]

# Krumhansl-Schmuckler key profiles
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

def pearson(a, b):
    a, b = np.array(a), np.array(b)
    return np.corrcoef(a, b)[0, 1]

def detect_key(path):
    librosa = load_librosa()
    y, sr = librosa.load(path, sr=None, mono=True, duration=120)
    # Compute chromagram using CQT (more accurate than STFT for key)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, bins_per_octave=36)
    mean_chroma = np.mean(chroma, axis=1)
    mean_chroma = mean_chroma / mean_chroma.max()

    best_key, best_scale, best_corr = 0, "major", -np.inf
    for i in range(12):
        maj = pearson(mean_chroma, np.roll(MAJOR_PROFILE, i))
        min_ = pearson(mean_chroma, np.roll(MINOR_PROFILE, i))
        if maj > best_corr:
            best_corr, best_key, best_scale = maj, i, "major"
        if min_ > best_corr:
            best_corr, best_key, best_scale = min_, i, "minor"

    strength = float(np.clip((best_corr + 1) / 2, 0, 1))

    if best_scale == "major":
        rel_idx = (best_key + 9) % 12
        rel_scale = "minor"
    else:
        rel_idx = (best_key + 3) % 12
        rel_scale = "major"

    return {
        "key": key_name(best_key, best_scale),
        "scale": best_scale,
        "strength": round(strength, 3),
        "relativeKey": key_name(rel_idx, rel_scale),
        "relativeScale": rel_scale,
    }

@app.route("/detect-key", methods=["POST"])
def handle():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    f = request.files["file"]
    suffix = os.path.splitext(f.filename)[1] or ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        f.save(tmp.name)
        tmp_path = tmp.name
    try:
        result = detect_key(tmp_path)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(tmp_path)

def detect_bpm(path):
    import essentia.standard as es

    # Load mono at 44100 Hz (essentia's native rate)
    loader = es.MonoLoader(filename=path, sampleRate=44100)
    audio = loader()

    # RhythmExtractor2013 — trained model, handles half/double tempo natively
    extractor = es.RhythmExtractor2013(method="multifeature")
    bpm, beats, beats_confidence, _, beats_intervals = extractor(audio)

    return {
        "bpm": round(float(bpm), 1),
        "timeSignature": "4/4",
        "beatCount": int(len(beats)),
    }

@app.route("/detect-bpm", methods=["POST"])
def handle_bpm():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    f = request.files["file"]
    suffix = os.path.splitext(f.filename)[1] or ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        f.save(tmp.name)
        tmp_path = tmp.name
    try:
        result = detect_bpm(tmp_path)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(tmp_path)

@app.route("/separate", methods=["POST"])
def handle_separate():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    if not _demucs_lock.acquire(blocking=False):
        return jsonify({"error": "Server busy processing another request, try again shortly"}), 429

    stem = request.form.get("stem", "no_vocals")  # no_vocals or vocals
    f = request.files["file"]
    original_name = os.path.splitext(f.filename)[0] or "track"
    suffix = os.path.splitext(f.filename)[1] or ".mp3"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        f.save(tmp.name)
        tmp_path = tmp.name

    out_dir = tempfile.mkdtemp()
    try:
        model = "mdx_q"
        result = subprocess.run(
            [
                os.environ.get("DEMUCS_PATH", "demucs"),
                "-n", model,
                "--two-stems", "vocals",
                "--jobs", "1",
                "--mp3",
                "--mp3-bitrate", "256",
                "-o", out_dir,
                tmp_path,
            ],
            capture_output=True, text=True, timeout=600
        )
        if result.returncode != 0:
            return jsonify({"error": result.stderr[-500:]}), 500

        # Demucs outputs to out_dir/<model>/<input_name>/{vocals,no_vocals}.mp3
        base = os.path.splitext(os.path.basename(tmp_path))[0]
        stem_path = os.path.join(out_dir, model, base, f"{stem}.mp3")

        if not os.path.exists(stem_path):
            return jsonify({"error": f"Output file not found: {stem_path}"}), 500

        download_name = f"{original_name}_{'instrumental' if stem == 'no_vocals' else 'vocals'}.mp3"
        return send_file(
            stem_path,
            mimetype="audio/mpeg",
            as_attachment=True,
            download_name=download_name,
        )
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Processing timed out (file may be too long)"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        _demucs_lock.release()
        os.unlink(tmp_path)
        shutil.rmtree(out_dir, ignore_errors=True)

@app.route("/health")
def health():
    return "ok"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"Audio analysis server running on http://{host}:{port}")
    app.run(host=host, port=port)

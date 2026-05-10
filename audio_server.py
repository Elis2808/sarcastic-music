import os, sys, json, tempfile
from flask import Flask, request, jsonify

app = Flask(__name__)

print("[audio_server] Loading librosa...", flush=True)
import numpy as np
import librosa
print("[audio_server] Loading essentia...", flush=True)
import essentia.standard as es
print("[audio_server] Ready.", flush=True)

MAJOR_KEY_NAMES = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"]
MINOR_KEY_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","Bb","B"]
MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]
MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]

def key_name(i, scale):
    return MAJOR_KEY_NAMES[i] if scale == "major" else MINOR_KEY_NAMES[i]

def pearson(a, b):
    a, b = np.array(a), np.array(b)
    return float(np.corrcoef(a, b)[0, 1])

@app.route("/bpm", methods=["POST"])
def detect_bpm():
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "No file"}), 400
    ext = f.filename.rsplit(".", 1)[-1] if "." in f.filename else "mp3"
    tmp = tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False)
    try:
        f.save(tmp.name)
        tmp.close()
        audio = es.MonoLoader(filename=tmp.name, sampleRate=22050)()
        bpm, beats, _, _, _ = es.RhythmExtractor2013(method="degara")(audio)
        return jsonify({"bpm": round(float(bpm), 1), "timeSignature": "4/4", "beatCount": int(len(beats))})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(tmp.name)

@app.route("/key", methods=["POST"])
def detect_key():
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "No file"}), 400
    ext = f.filename.rsplit(".", 1)[-1] if "." in f.filename else "mp3"
    tmp = tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False)
    try:
        f.save(tmp.name)
        tmp.close()
        y, sr = librosa.load(tmp.name, sr=22050, mono=True, duration=30)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, bins_per_octave=36)
        mean_chroma = np.mean(chroma, axis=1)
        mean_chroma = mean_chroma / mean_chroma.max()
        best_key, best_scale, best_corr = 0, "major", -np.inf
        for i in range(12):
            maj = pearson(mean_chroma, np.roll(MAJOR_PROFILE, i))
            min_ = pearson(mean_chroma, np.roll(MINOR_PROFILE, i))
            if maj > best_corr: best_corr, best_key, best_scale = maj, i, "major"
            if min_ > best_corr: best_corr, best_key, best_scale = min_, i, "minor"
        strength = float(np.clip((best_corr + 1) / 2, 0, 1))
        rel_idx = (best_key + 9) % 12 if best_scale == "major" else (best_key + 3) % 12
        rel_scale = "minor" if best_scale == "major" else "major"
        return jsonify({
            "key": key_name(best_key, best_scale),
            "scale": best_scale,
            "strength": round(strength, 3),
            "relativeKey": key_name(rel_idx, rel_scale),
            "relativeScale": rel_scale,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(tmp.name)

@app.route("/health")
def health():
    return "ok"

if __name__ == "__main__":
    port = int(os.environ.get("AUDIO_SERVER_PORT", "5001"))
    try:
        from waitress import serve
        print(f"[audio_server] Serving on port {port} (waitress)", flush=True)
        serve(app, host="0.0.0.0", port=port, threads=4)
    except ImportError:
        app.run(host="0.0.0.0", port=port, threaded=True)

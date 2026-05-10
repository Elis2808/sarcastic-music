import os, json, tempfile
from flask import Flask, request, jsonify

app = Flask(__name__)

print("[audio_server] Loading essentia...", flush=True)
import essentia.standard as es
print("[audio_server] Ready.", flush=True)

RELATIVE = {
    "C major": ("A", "minor"), "G major": ("E", "minor"), "D major": ("B", "minor"),
    "A major": ("F#", "minor"), "E major": ("C#", "minor"), "B major": ("G#", "minor"),
    "F# major": ("D#", "minor"), "Db major": ("Bb", "minor"), "Ab major": ("F", "minor"),
    "Eb major": ("C", "minor"), "Bb major": ("G", "minor"), "F major": ("D", "minor"),
    "A minor": ("C", "major"), "E minor": ("G", "major"), "B minor": ("D", "major"),
    "F# minor": ("A", "major"), "C# minor": ("E", "major"), "G# minor": ("B", "major"),
    "D# minor": ("F#", "major"), "Bb minor": ("Db", "major"), "F minor": ("Ab", "major"),
    "C minor": ("Eb", "major"), "G minor": ("Bb", "major"), "D minor": ("F", "major"),
}

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
        audio = es.MonoLoader(filename=tmp.name, sampleRate=44100)()
        # Use only first 60s for speed
        audio = audio[:44100 * 60]
        key, scale, strength = es.KeyExtractor(profileType="temperley")(audio)
        label = f"{key} {scale}"
        rel = RELATIVE.get(label, (None, None))
        return jsonify({
            "key": key,
            "scale": scale,
            "strength": round(float(strength), 3),
            "relativeKey": rel[0] or "",
            "relativeScale": rel[1] or "",
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

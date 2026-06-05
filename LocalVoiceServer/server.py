import os
import sys

# Prevent PyInstaller windowed app crashes due to print statements
if getattr(sys, 'frozen', False):
    log_file = open(os.path.join(os.path.dirname(sys.executable), "error.log"), 'w')
    sys.stdout = log_file
    sys.stderr = log_file

import io
from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from piper.voice import PiperVoice
import wave

# Automatically find the correct directory whether running as python script or PyInstaller bundle
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    # PyInstaller bundles piper's espeak-ng-data into _internal
    os.environ['PIPER_ESPEAKNG_DATA_DIRECTORY'] = os.path.join(BASE_DIR, '_internal', 'piper', 'espeak-ng-data')
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

loaded_voices = {}

def get_voice(voice_id):
    if voice_id not in loaded_voices:
        model_path = os.path.join(BASE_DIR, f"{voice_id}.onnx")
        print(f"[DEBUG] Attempting to load model from: {model_path}")
        if os.path.exists(model_path):
            print(f"Loading voice: {voice_id}...")
            loaded_voices[voice_id] = PiperVoice.load(model_path)
        else:
            print(f"[ERROR] File does not exist: {model_path}")
            return None
    return loaded_voices[voice_id]

import numpy as np

@app.post("/speak")
async def speak(request: Request):
    data = await request.json()
    text = data.get("text", "")
    voice_id = data.get("voice", "en_US-lessac-high")
    
    print(f"\n[DEBUG] Request received! Requested voice: {voice_id}")
    
    if not text:
        return Response(status_code=400)
    
    voice = get_voice(voice_id)
    if not voice:
        return Response(content="Voice not found on server.", status_code=404)
    
    # Generate audio
    audio_stream = io.BytesIO()
    with wave.open(audio_stream, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(voice.config.sample_rate)
        
        for chunk in voice.synthesize(text):
            audio_data = (chunk.audio_float_array * 32767.0).astype(np.int16).tobytes()
            wav_file.writeframes(audio_data)
    
    audio_data = audio_stream.getvalue()
    return Response(content=audio_data, media_type="audio/wav")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

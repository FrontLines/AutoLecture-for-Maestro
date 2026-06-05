import urllib.request
import os

print("Downloading voice model...")
onnx_url = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/high/en_US-lessac-high.onnx"
json_url = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/high/en_US-lessac-high.onnx.json"

if not os.path.exists("en_US-lessac-high.onnx"):
    urllib.request.urlretrieve(onnx_url, "en_US-lessac-high.onnx")
if not os.path.exists("en_US-lessac-high.onnx.json"):
    urllib.request.urlretrieve(json_url, "en_US-lessac-high.onnx.json")

print("Download complete!")

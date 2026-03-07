import os
import base64
from pathlib import Path
import requests

API_KEY = os.environ.get('VENICE_API_KEY')
if not API_KEY:
    raise SystemExit('Set VENICE_API_KEY before running this script.')

OUT = Path(r'C:\Users\vivek\.openclaw\workspace\Vivmusic\public\generated')
OUT.mkdir(parents=True, exist_ok=True)

url = 'https://api.venice.ai/api/v1/image/generate'
headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

jobs = [
    {
        'filename': 'hero-studio.webp',
        'payload': {
            'model': 'z-image-turbo',
            'prompt': 'Minimal UI / Clean UI hero artwork for an AI music creation studio. Bright white background, subtle cyan accents, floating glass-like music interface panels, elegant waveform lines, restrained equalizer bars, premium whitespace, focused composition, sophisticated and calm, music-focused but abstract, clear and modern, no visible text, advertising quality.',
            'width': 1280,
            'height': 960,
            'style_preset': 'Advertising',
            'format': 'webp'
        }
    },
    {
        'filename': 'moodboard-minimal.webp',
        'payload': {
            'model': 'z-image-turbo',
            'prompt': 'Minimalist moodboard artwork for a music production interface. Clean white and soft gray surfaces, cyan accent light, soft shadows, abstract vinyl and waveform geometry, sophisticated product-design aesthetic, serene and focused, premium web app visual, no text, minimalist style.',
            'width': 1200,
            'height': 900,
            'style_preset': 'Minimalist',
            'format': 'webp'
        }
    }
]

for job in jobs:
    resp = requests.post(url, headers=headers, json=job['payload'], timeout=300)
    print(job['filename'], resp.status_code)
    if resp.status_code != 200:
        print(resp.text)
    resp.raise_for_status()
    data = resp.json()
    b64 = data['images'][0]
    out = OUT / job['filename']
    out.write_bytes(base64.b64decode(b64))
    print('saved', out)

print('done')

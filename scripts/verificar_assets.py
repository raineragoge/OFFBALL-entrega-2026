"""Verifica los archivos de inferencia sin cargar modelos Joblib."""
from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[1] / "OFFBALL_API"
manifest = json.loads((root / "assets_manifest.json").read_text(encoding="utf-8"))
ok = True
for name, expected in manifest.items():
    path = root / "assets" / name
    match = path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == expected
    print(f"{'OK' if match else 'FALTA O NO COINCIDE'}: {name}")
    ok &= match
sys.exit(0 if ok else 1)

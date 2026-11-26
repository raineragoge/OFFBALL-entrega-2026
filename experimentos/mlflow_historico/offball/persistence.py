"""Persistencia de artefactos propios; un hash no convierte pickle en seguro."""
import hashlib
import json
import platform
from importlib.metadata import version
from pathlib import Path

import cloudpickle


def versions():
    return {"python": platform.python_version(), **{n:version(n) for n in ["scikit-learn", "numpy", "pandas", "cloudpickle", "mlflow"]}}


def save_bundle(bundle, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    content = cloudpickle.dumps(bundle, protocol=5)
    digest = hashlib.sha256(content).hexdigest()
    (directory / "bundle.pkl").write_bytes(content)
    (directory / "manifest.json").write_text(json.dumps({"sha256": digest, "versions": versions()}, indent=2), encoding="utf8")
    return digest


def load_bundle(directory, expected_sha256):
    """El hash debe provenir del operador, por un canal de confianza.

    No aceptamos rutas/modelos/hash suministrados por peticiones HTTP. Verificamos
    integridad ANTES de deserializar. Conservar artefactos y configuración con ACL.
    """
    if not expected_sha256:
        raise ValueError("Se requiere el SHA256 de un artefacto de procedencia confiable")
    directory = Path(directory)
    content = (directory / "bundle.pkl").read_bytes()
    if hashlib.sha256(content).hexdigest() != expected_sha256:
        raise ValueError("Integridad del modelo incorrecta")
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf8"))
    if manifest["versions"] != versions():
        raise ValueError("Versiones incompatibles; reproduzca el entorno de entrenamiento")
    return cloudpickle.loads(content)

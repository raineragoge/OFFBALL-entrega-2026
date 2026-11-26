"""Ventanas históricas: nunca agregamos un partido del día objetivo o posterior."""
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

COUNTERS = ["minutes_played", "goals", "assists", "yellow_cards", "red_cards"]
FEATURES = ["edad", "minutos", "partidos", "goles_90", "asistencias_90", "amarillas_90", "rojas_90"]
SPORT = FEATURES[1:]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def extract_zip(source, target):
    """Extraemos nombres permitidos; no ejecutamos ni seguimos rutas del ZIP."""
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as z:
        for name in ["players.csv", "appearances.csv", "player_valuations.csv"]:
            matches = [n for n in z.namelist() if Path(n).name == name]
            if len(matches) != 1:
                raise ValueError(f"Se requiere exactamente un {name}")
            with z.open(matches[0]) as src, open(target / name, "wb") as dst:
                shutil.copyfileobj(src, dst)


def clean(frame, key, dates, numeric):
    frame = frame.drop_duplicates().copy()
    for col in dates:
        frame[col] = pd.to_datetime(frame[col], errors="coerce")
    for col in numeric:
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    # Una clave duplicada con valores contradictorios no se resuelve arbitrariamente.
    if frame.duplicated(key).any():
        raise ValueError(f"Claves contradictorias: {key}")
    return frame


def build_dataset(players, appearances, valuations, min_minutes=450):
    p = clean(players[["player_id", "date_of_birth"]], ["player_id"], ["date_of_birth"], ["player_id"])
    a = clean(appearances[["player_id", "game_id", "date"] + COUNTERS], ["player_id", "game_id"], ["date"], ["player_id"] + COUNTERS)
    v = clean(valuations[["player_id", "date", "market_value_in_eur"]], ["player_id", "date"], ["date"], ["player_id", "market_value_in_eur"])
    a = a.dropna(subset=["player_id", "game_id", "date"] + COUNTERS)
    a = a[np.isfinite(a[COUNTERS]).all(axis=1) & (a[COUNTERS] >= 0).all(axis=1) & (a.minutes_played <= 130)]
    v = v.dropna().loc[lambda x: np.isfinite(x.market_value_in_eur) & (x.market_value_in_eur > 0)].copy()
    p = p.dropna()
    a.player_id = a.player_id.astype("int64")
    v.player_id = v.player_id.astype("int64")
    v["temporada"] = v.date.dt.year - (v.date.dt.month < 7).astype(int)
    v = v.sort_values(["date", "player_id"]).drop_duplicates(["player_id", "temporada"], keep="last")
    v = v[v.temporada.between(2015, 2025)].rename(columns={"date": "fecha_valoracion", "market_value_in_eur": "valor_mercado_eur"}).reset_index(drop=True)
    v["fila_id"] = np.arange(len(v))
    a["partidos"] = 1
    counters = COUNTERS + ["partidos"]
    daily = a.groupby(["player_id", "date"], as_index=False)[counters].sum().sort_values(["player_id", "date"])
    daily[counters] = daily.groupby("player_id")[counters].cumsum()
    daily = daily.sort_values("date")

    def at(days):
        q = v[["fila_id", "player_id"]].copy()
        q["corte"] = v.fecha_valoracion - pd.Timedelta(days=days)
        return pd.merge_asof(q.sort_values("corte"), daily, left_on="corte", right_on="date", by="player_id", direction="backward").sort_values("fila_id")

    # [D-365, D): restar acumulados D-1 y D-366 incluye el límite inferior.
    end, start = at(1), at(366)
    v[counters] = end[counters].fillna(0).to_numpy() - start[counters].fillna(0).to_numpy()
    v["ultima_aparicion"] = end.date.to_numpy()
    v = v.merge(p, on="player_id", validate="many_to_one")
    v["edad"] = (v.fecha_valoracion - v.date_of_birth).dt.days / 365.25
    for original, name in zip(COUNTERS[1:], FEATURES[3:]):
        v[name] = 90 * v[original] / v.minutes_played.replace(0, np.nan)
    v = v.rename(columns={"minutes_played": "minutos"})
    v = v[(v.minutos >= min_minutes) & v.edad.between(15, 45)].copy()
    if not (v.ultima_aparicion < v.fecha_valoracion).all():
        raise AssertionError("Fuga temporal en apariciones")
    return v.sort_values(["fecha_valoracion", "player_id"]).reset_index(drop=True)


def split_dataset(df):
    """Cohortes hash estables, independientes de valores y de presencia futura.

    Exigimos simultáneamente separación cronológica y de identidad. Se descartan
    temporadas fuera del periodo asignado a cada cohorte; no se reciclan en train.
    """
    bucket = df.player_id.map(lambda x: int(hashlib.sha256(f"offball42:{int(x)}".encode()).hexdigest()[:8], 16) % 100)
    train = df[(bucket < 70) & (df.temporada <= 2023)].copy()
    valid = df[bucket.between(70, 84) & (df.temporada == 2024)].copy()
    test = df[(bucket >= 85) & (df.temporada == 2025)].copy()
    if min(map(len, [train, valid, test])) < 2:
        raise ValueError("No hay train/validación/test temporal 2025/26 suficiente; no se sustituye silenciosamente")
    assert train.fecha_valoracion.max() < valid.fecha_valoracion.min() < test.fecha_valoracion.min()
    for x, y in [(train, valid), (train, test), (valid, test)]:
        assert not set(x.player_id) & set(y.player_id)
    return train, valid, test


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=Path, default=Path("raw"))
    parser.add_argument("--zip", type=Path)
    parser.add_argument("--output", type=Path, default=Path("processed/temporal"))
    args = parser.parse_args()
    if args.zip:
        extract_zip(args.zip, args.raw)
    args.output.mkdir(parents=True, exist_ok=True)
    tables, audit = {}, {}
    for name in ["players", "appearances", "player_valuations"]:
        path = args.raw / f"{name}.csv"
        if not path.exists():
            raise FileNotFoundError(f"Falta {path}; aporte los CSV o --zip")
        frame = pd.read_csv(path, low_memory=False)
        tables[name] = frame
        audit[name] = {"rows": len(frame), "sha256": sha256(path), "exact_duplicates": int(frame.duplicated().sum()), "nulls": frame.isna().sum().to_dict()}
        if "date" in frame:
            dates = pd.to_datetime(frame.date, errors="coerce")
            audit[name].update(date_min=str(dates.min()), date_max=str(dates.max()), invalid_dates=int(dates.isna().sum()))
    df = build_dataset(tables["players"], tables["appearances"], tables["player_valuations"])
    df.to_parquet(args.output / "dataset.parquet", index=False)
    audit["dataset"] = {"rows": len(df), "players": int(df.player_id.nunique()), "seasons": df.groupby("temporada").size().to_dict(), "summary": df[FEATURES + ["valor_mercado_eur"]].describe(percentiles=[.01,.5,.99]).to_dict()}
    for name, part in zip(["train", "valid", "test"], split_dataset(df)):
        part.to_parquet(args.output / f"{name}.parquet", index=False)
        audit[name] = {"rows": len(part), "players": int(part.player_id.nunique()), "start": str(part.fecha_valoracion.min()), "end": str(part.fecha_valoracion.max())}
    (args.output / "audit.json").write_text(json.dumps(audit, indent=2, ensure_ascii=False), encoding="utf8")
    print(json.dumps({k:audit[k] for k in ["train", "valid", "test"]}, indent=2))


if __name__ == "__main__":
    main()

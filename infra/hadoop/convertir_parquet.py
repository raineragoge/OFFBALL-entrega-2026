"""Conversión local CSV -> Parquet Snappy; no modifica los CSV."""
from pathlib import Path
import pyarrow.csv as csv
import pyarrow.parquet as pq

for nombre in ("appearances", "players", "clubs", "games", "player_valuations"):
    tabla = csv.read_csv(Path("/entrada") / f"{nombre}.csv",
                         read_options=csv.ReadOptions(use_threads=False))
    destino = Path("/salida") / f"{nombre}.parquet"
    pq.write_table(tabla, destino, compression="snappy")
    assert pq.ParquetFile(destino).metadata.num_rows == tabla.num_rows
    print(nombre, tabla.num_rows, destino.stat().st_size, tabla.schema)

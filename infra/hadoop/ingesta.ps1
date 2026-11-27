param(
    [Parameter(Mandatory=$true)][ValidateSet("raw","silver","gold")][string]$Capa,
    [Parameter(Mandatory=$true)][string]$Origen
)
$ErrorActionPreference = "Stop"
$tablas = @("appearances","players","clubs","games","player_valuations")
if ($Capa -eq "gold") {
    $archivos = @("OFFBALL_dataset_analitico_EXTENDIDO.parquet","predicciones_test.parquet","predicciones_validacion.parquet","catalogo_historico.parquet")
} else {
    $ext = if ($Capa -eq "raw") { "csv" } else { "parquet" }
    $archivos = $tablas | ForEach-Object { "$_.$ext" }
}
foreach ($nombre in $archivos) {
    $encontrados = @(Get-ChildItem -LiteralPath $Origen -Recurse -File -Filter $nombre)
    if ($encontrados.Count -ne 1) { throw "Se requiere una copia inequívoca de $nombre; encontradas: $($encontrados.Count)" }
    $dest = if ($Capa -eq "gold") { "/offball/gold" } else { "/offball/$Capa/$([IO.Path]::GetFileNameWithoutExtension($nombre))" }
    docker compose exec -T namenode hdfs dfs -mkdir -p $dest
    if ($LASTEXITCODE -ne 0) { throw "mkdir: $dest" }
    docker compose cp "$($encontrados[0].FullName)" "namenode:/tmp/$nombre"
    if ($LASTEXITCODE -ne 0) { throw "cp: $nombre" }
    docker compose exec -T namenode hdfs dfs -put -f "/tmp/$nombre" "$dest/"
    if ($LASTEXITCODE -ne 0) { throw "put: $nombre" }
    docker compose exec -T -u root namenode rm -f "/tmp/$nombre"
    if ($LASTEXITCODE -ne 0) { throw "rm: $nombre" }
    Write-Host "OK: $nombre"
}
docker compose exec namenode hdfs dfs -ls -R "/offball/$Capa"
docker compose exec namenode hdfs fsck "/offball/$Capa"

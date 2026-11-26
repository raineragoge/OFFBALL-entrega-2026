# OFFBALL. — Football Intelligence

**Ver lo que otros no ven.**

Proyecto académico de Inteligencia Artificial y Big Data · Cebanc · noviembre de 2026.

OFFBALL ayuda a los clubes profesionales con presupuestos ajustados a explorar perfiles deportivos y estimar el valor de mercado de futbolistas. Es una herramienta de apoyo al scouting, no un sistema de fichajes autónomo.

## Versión v0.4.2

- GMM extendido con cinco componentes y cobertura de 14 ligas.
- Random Forest G02 con transformación logarítmica del objetivo; G01 como referencia comparativa.
- FastAPI y Pydantic; frontend React, TypeScript y Vite; Docker Compose.
- Hadoop, HDFS, Hive y arquitectura Medallion.
- Validación temporal, prevención de fugas de información y análisis de errores.
- Seguimiento histórico de experimentos con MLflow.

## Estado de la publicación

Repositorio público de entrega académica. El código, notebooks sin salidas sensibles, métricas agregadas y documentación reproducible se incorporan desde el paquete de entrega. Los modelos, catálogo y datasets de terceros quedan fuera de Git mientras no se verifiquen sus permisos de redistribución.

La aplicación se verificó localmente con los artefactos originales; una copia pública sin esos artefactos no puede reproducir por sí sola toda la inferencia. El registro histórico de MLflow no acredita el registro de los modelos finales K5 y G02.

No se concede licencia sobre contenidos de terceros. No se incluyen historiales médicos privados.

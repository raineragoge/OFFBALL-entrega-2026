"""Comparación sobre train/validación; test se abre después de fijar la decisión."""
import argparse
import json
import os
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, davies_bouldin_score, mean_absolute_error, mean_squared_error, r2_score, adjusted_rand_score
from sklearn.mixture import GaussianMixture
from sklearn.pipeline import Pipeline
from threadpoolctl import threadpool_limits

from offball.data import FEATURES, SPORT, sha256
from offball.models import preprocessing, regression
from offball.persistence import save_bundle, load_bundle, versions


def metrics(y, pred):
    result = {}
    for suffix, real, estimate in [("eur", y, pred), ("log", np.log1p(y), np.log1p(pred))]:
        result.update({f"MAE_{suffix}": float(mean_absolute_error(real, estimate)), f"RMSE_{suffix}": float(mean_squared_error(real, estimate)**.5), f"R2_{suffix}": float(r2_score(real, estimate))})
    return result


def log_model(model, example, name="model", registered=None):
    # MLflow/skops puede fallar con TreePredictor. Indicamos cloudpickle de forma
    # explícita y solo cargamos modelos creados en este proceso de confianza.
    info = mlflow.sklearn.log_model(model, name=name, serialization_format="cloudpickle", input_example=example, pip_requirements=[f"{n}=={v}" for n,v in versions().items() if n != "python"], code_paths=[str(Path(__file__).parent)], registered_model_name=registered)
    return info


def train(args):
    out = args.output.resolve()
    if out.exists() and any(out.iterdir()):
        raise FileExistsError("Use una salida nueva para conservar resultados anteriores")
    out.mkdir(parents=True, exist_ok=True)
    mlflow.set_tracking_uri("sqlite:///" + (out / "mlflow.db").as_posix())
    # Este permiso queda limitado al proceso que registra/carga sus propios modelos.
    os.environ["MLFLOW_ALLOW_PICKLE_DESERIALIZATION"] = "true"
    os.environ["MLFLOW_ALLOW_MODEL_CODE_EXECUTION"] = "true"
    train = pd.read_parquet(args.data / "train.parquet")
    valid = pd.read_parquet(args.data / "valid.parquet")
    if set(train.player_id) & set(valid.player_id) or train.fecha_valoracion.max() >= valid.fecha_valoracion.min():
        raise ValueError("Particiones de desarrollo contaminadas")
    provenance = {"versions": versions(), "data_hashes": {n:sha256(args.data / f"{n}.parquet") for n in ["train", "valid"]}, "seed":42, "max_k":args.max_k}
    (out / "provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf8")
    # Misma muestra de train para todos los candidatos; silhouette cuadrática
    # se calcula en 1200 filas, nunca en test.
    sample = train.sample(min(40000, len(train)), random_state=42)
    pre = preprocessing(SPORT).fit(sample)
    z = pre.transform(sample)
    zs = z[np.random.default_rng(42).choice(len(z), min(1200,len(z)), replace=False)]
    mlflow.set_experiment("OFFBALL_clustering")
    rows, fitted = [], {}
    for kind in ["kmeans", "gmm"]:
        for k in range(1 if kind == "gmm" else 2, min(args.max_k, len(sample)-1)+1):
            model = (KMeans(n_clusters=k, n_init=10, random_state=42) if kind == "kmeans" else GaussianMixture(n_components=k, covariance_type="diag", n_init=3, max_iter=300, reg_covar=1e-4, random_state=42)).fit(z)
            labels = model.predict(zs)
            score = {}
            if 1 < len(set(labels)) < len(labels):
                score.update(silhouette=float(silhouette_score(zs, labels)), davies_bouldin=float(davies_bouldin_score(zs, labels)))
            if kind == "gmm":
                score.update(bic=float(model.bic(z)), aic=float(model.aic(z)), converged=int(model.converged_))
            else:
                score["inertia"] = float(model.inertia_)
            pipeline = Pipeline([("pre", pre), ("model", model)])
            with mlflow.start_run(run_name=f"{kind}_k{k}") as run:
                mlflow.log_params({"algorithm":kind, "k":k, "seed":42, "n_train":len(sample), "covariance":"diag" if kind == "gmm" else "none", "selection_data":"train"})
                mlflow.log_metrics(score)
                mlflow.log_artifact(str(out / "provenance.json"))
                log_model(pipeline, sample[FEATURES].head(3))
                row = {"algorithm":kind, "k":k, "run_id":run.info.run_id, **score}
            rows.append(row)
            fitted[(kind,k)] = pipeline
            print(kind, k, score, flush=True)
    comparison = pd.DataFrame(rows)
    comparison.to_csv(out / "clustering.csv", index=False)
    gmrow = comparison.query("algorithm == 'gmm' and converged == 1").sort_values("bic").iloc[0]
    kmrow = comparison.query("algorithm == 'kmeans'").sort_values("silhouette", ascending=False).iloc[0]
    k = int(gmrow.k)
    gmm = fitted[("gmm", k)]
    km = fitted[("kmeans", int(kmrow.k))]
    profile = sample[SPORT].copy()
    profile["perfil"] = gmm.predict(sample)
    profile.groupby("perfil")[SPORT].agg(["count", "mean", "median"]).to_csv(out / "profiles.csv")
    # Estabilidad de la solución ganadora con otra inicialización, sin tocar test.
    stability = clone(gmm.named_steps["model"]).set_params(random_state=7).fit(z)
    ari = float(adjusted_rand_score(gmm.predict(sample), stability.predict(z)))
    fig, ax = plt.subplots(1,2,figsize=(11,4))
    for kind, group in comparison.groupby("algorithm"):
        ax[0].plot(group.k, group.silhouette, "o-", label=kind)
    group = comparison.query("algorithm == 'gmm'")
    ax[1].plot(group.k,group.bic,"o-",label="BIC")
    ax[1].plot(group.k,group.aic,"o-",label="AIC")
    for a in ax:
        a.set_xlabel("Número de grupos"); a.legend()
    ax[0].set_ylabel("Silhouette (train)"); ax[1].set_ylabel("Criterio de información (menor mejor)")
    fig.tight_layout(); fig.savefig(out / "clustering.png",dpi=150); plt.close(fig)
    mlflow.set_experiment("OFFBALL_regresion")
    configs = [("baseline",False,{})]
    configs += [("ridge", flag, {"alpha":alpha}) for flag in [False,True] for alpha in [0.1,10.,100.]]
    configs += [("hgb", flag, {"max_leaf_nodes":leaves,"l2_regularization":l2,"learning_rate":.06}) for flag in [False,True] for leaves,l2 in [(15,2.),(31,2.),(15,10.)]]
    candidates, results = {}, []
    for idx,(kind, flag, params) in enumerate(configs):
        name = f"{kind}_{'gmm' if flag else 'base'}_{idx}"
        model = regression(kind,flag,k,**params).fit(train[FEATURES], train.valor_mercado_eur)
        scores = metrics(valid.valor_mercado_eur,model.predict(valid[FEATURES]))
        with mlflow.start_run(run_name=name) as run:
            mlflow.log_params({"algorithm":kind,"with_gmm":flag,"k":k if flag else 0,"seed":42,"selection_metric":"valid_MAE_eur",**params})
            mlflow.log_metrics({"valid_"+key:value for key,value in scores.items()})
            mlflow.log_artifact(str(out / "provenance.json"))
            log_model(model,train[FEATURES].head(3))
            results.append({"name":name,"algorithm":kind,"with_gmm":flag,"run_id":run.info.run_id,**params,**scores})
        candidates[name] = model
        print(name,scores,flush=True)
    ranking = pd.DataFrame(results).sort_values(["MAE_eur","name"])
    ranking.to_csv(out / "validation.csv",index=False)
    winner = ranking.iloc[0]["name"]
    decision = {"winner":winner,"selection":"Menor MAE EUR validación 2024/25", "gmm_k":k,"kmeans_k":int(kmrow.k),"gmm_stability_ARI":ari,"gmm_search_boundary":bool(k == args.max_k),"test_used_for_selection":False}
    # Persistimos la decisión ANTES de abrir el archivo de test.
    (out / "selection.json").write_text(json.dumps(decision,indent=2),encoding="utf8")
    development = pd.concat([train,valid],ignore_index=True)
    final = clone(candidates[winner]).fit(development[FEATURES],development.valor_mercado_eur)
    test = pd.read_parquet(args.data / "test.parquet")
    if set(test.player_id) & set(development.player_id) or development.fecha_valoracion.max() >= test.fecha_valoracion.min() or not test.temporada.eq(2025).all():
        raise ValueError("Test temporal o identidades contaminadas")
    pred = final.predict(test[FEATURES])
    scores = metrics(test.valor_mercado_eur,pred)
    (out / "test_metrics.json").write_text(json.dumps(scores,indent=2),encoding="utf8")
    report = test[["player_id","fecha_valoracion","valor_mercado_eur"]].copy()
    report["prediction_eur"] = pred
    report["error_eur"] = pred - test.valor_mercado_eur
    report.to_parquet(out / "test_predictions.parquet",index=False)
    fig,ax = plt.subplots(1,2,figsize=(11,4))
    ax[0].scatter(test.valor_mercado_eur,pred,s=8,alpha=.3)
    ax[0].set(xscale="log",yscale="log",xlabel="Valor publicado EUR",ylabel="Estimación EUR")
    ax[1].hist(report.error_eur/1e6,bins=50); ax[1].set(xlabel="Error EUR (millones)",ylabel="Jugadores")
    fig.tight_layout(); fig.savefig(out / "test_errors.png",dpi=150); plt.close(fig)
    best_per_family = ranking.drop_duplicates(["algorithm","with_gmm"]).sort_values("MAE_eur")
    fig,ax = plt.subplots(figsize=(9,4)); ax.barh(best_per_family.name,best_per_family.MAE_eur/1e6); ax.set_xlabel("MAE validación (millones EUR)"); fig.tight_layout(); fig.savefig(out / "validation.png",dpi=150); plt.close(fig)
    with mlflow.start_run(run_name="final_"+winner) as run:
        mlflow.log_params(decision)
        mlflow.log_metrics({"test_"+key:value for key,value in scores.items()})
        info = log_model(final,development[FEATURES].head(3),"regression", "OFFBALL_regression")
        cluster_info = log_model(gmm,train[FEATURES].head(3),"clustering", "OFFBALL_clustering")
        loaded = mlflow.sklearn.load_model(info.model_uri)
        np.testing.assert_allclose(loaded.predict(test[FEATURES].head(20)),pred[:20])
        loaded_gmm = mlflow.sklearn.load_model(cluster_info.model_uri)
        np.testing.assert_allclose(loaded_gmm.predict_proba(test[FEATURES].head(20)),gmm.predict_proba(test[FEATURES].head(20)))
        bundle = {"regression":final,"gmm":gmm,"kmeans":km,"selection":decision}
        digest = save_bundle(bundle,out / "models")
        restored = load_bundle(out / "models",digest)
        np.testing.assert_allclose(restored["regression"].predict(test[FEATURES].head(20)),pred[:20])
        evidence = {"run_id":run.info.run_id,"regression_uri":info.model_uri,"clustering_uri":cluster_info.model_uri,"bundle_sha256":digest,"roundtrip_rows":20,"test_sha256":sha256(args.data / "test.parquet")}
        (out / "verification.json").write_text(json.dumps(evidence,indent=2),encoding="utf8")
        for path in out.iterdir():
            if path.suffix in [".json",".png",".csv"]:
                mlflow.log_artifact(str(path))
    print(json.dumps({**decision,**scores,**evidence},indent=2),flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data",type=Path,default=Path("processed/temporal"))
    parser.add_argument("--output",type=Path,default=Path("runs/verified"))
    parser.add_argument("--max-k",type=int,default=12)
    args = parser.parse_args()
    if args.max_k < 2:
        parser.error("--max-k debe ser >=2")
    with threadpool_limits(limits=2):
        train(args)


if __name__ == "__main__":
    main()

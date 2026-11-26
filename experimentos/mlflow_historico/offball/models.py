"""Transformaciones dentro del estimador: se ajustan únicamente en fit."""
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.mixture import GaussianMixture
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.preprocessing import StandardScaler

from offball.data import FEATURES, SPORT


def preprocessing(columns):
    return ColumnTransformer([("numeric", Pipeline([
        ("impute", SimpleImputer(strategy="median", keep_empty_features=True)),
        ("scale", StandardScaler()),
    ]), columns)], remainder="drop")


class GMMFeatures(TransformerMixin, BaseEstimator):
    """Probabilidades, no etiquetas ordinales: cada columna es un perfil mixto."""
    def __init__(self, n_components=2, seed=42):
        self.n_components = n_components
        self.seed = seed

    def fit(self, X, y=None):
        self.pre_ = preprocessing(SPORT)
        z = self.pre_.fit_transform(X)
        self.gmm_ = GaussianMixture(n_components=self.n_components, covariance_type="diag", n_init=3, max_iter=300, reg_covar=1e-4, random_state=self.seed).fit(z)
        if not self.gmm_.converged_:
            raise ValueError("El GMM no ha convergido")
        return self

    def transform(self, X):
        return self.gmm_.predict_proba(self.pre_.transform(X))


def inverse_log(z):
    # El valor económico no es negativo. El límite superior evita overflow;
    # exp(30) queda muy por encima del rango de entrenamiento y se documenta.
    return np.expm1(np.clip(z, 0, 30))


def regression(kind, with_gmm=False, k=2, **params):
    prep = preprocessing(FEATURES)
    if with_gmm:
        prep = FeatureUnion([("base", prep), ("gmm", GMMFeatures(k))])
    if kind == "baseline":
        estimator = DummyRegressor(strategy="median")
    elif kind == "ridge":
        estimator = Ridge(**params)
    elif kind == "hgb":
        # early_stopping aleatorio se desactiva: el ajuste usa validación temporal externa.
        estimator = HistGradientBoostingRegressor(random_state=42, early_stopping=False, max_iter=200, **params)
    else:
        raise ValueError(kind)
    return TransformedTargetRegressor(regressor=Pipeline([("features", prep), ("model", estimator)]), func=np.log1p, inverse_func=inverse_log, check_inverse=False)

from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Position = Literal['Attack','Midfield','Defender','Goalkeeper']
SUBPOS = {
    'Attack': ['Centre-Forward','Second Striker','Left Winger','Right Winger'],
    'Midfield': ['Attacking Midfield','Central Midfield','Defensive Midfield','Left Midfield','Right Midfield'],
    'Defender': ['Centre-Back','Left-Back','Right-Back'],
    'Goalkeeper': ['Goalkeeper'],
}
class Stats(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    position: Position
    sub_position: str
    minutos: int = Field(ge=450, le=10000)
    goles: int = Field(ge=0, le=300)
    asistencias: int = Field(ge=0, le=300)

    @model_validator(mode='after')
    def check_position(self):
        if self.sub_position not in SUBPOS[self.position]:
            raise ValueError('Subposición incompatible con posición')
        return self

class EconomicInput(Stats):
    age: int = Field(ge=15, le=45)
    partidos: int = Field(ge=1, le=100)
    competition_id: str = Field(min_length=1,max_length=20)
    market_value_in_eur: float | None = Field(default=None, gt=0, le=1e10)
    fin_temporada: date
    valuation_date: date

    @model_validator(mode='after')
    def check_temporal(self):
        if not 1 <= (self.valuation_date-self.fin_temporada).days <= 365:
            raise ValueError('La temporada cerrada debe preceder la valoración entre 1 y 365 días')
        if self.minutos > self.partidos * 90:
            raise ValueError('Minutos superiores a 90 por partido de liga')
        if self.valuation_date > date.today():
            raise ValueError('Fecha de valoración futura')
        return self

class OffensiveInput(Stats):
    height_in_cm: float = Field(ge=140,le=220)
    foot: Literal['left','right','both','desconocido'] | None = None

    @model_validator(mode='after')
    def check_offensive(self):
        if self.sub_position not in ['Centre-Forward','Second Striker','Left Winger','Right Winger','Attacking Midfield']:
            raise ValueError('El GMM está limitado a posiciones ofensivas')
        return self

class EconomicResult(BaseModel):
    modelo: str
    valor_estimado_eur: float
    referencia_directa_eur: float
    valor_observado_eur: float | None
    diferencia_eur: float | None
    diferencia_pct: float | None
    residuo_log: float | None
    umbral_p95: float | None
    alerta_economica: bool | None
    rango: str | None
    goles_90: float
    asistencias_90: float
    advertencias: list[str]

class Profile(BaseModel):
    cluster: int
    perfil: str
    probabilidad: float

class OffensiveResult(BaseModel):
    modelo: str
    perfiles: list[Profile]
    afinidad: dict[str,float]
    mejor_zona: str
    alternativa: str
    advertencias: list[str]

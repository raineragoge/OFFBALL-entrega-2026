CREATE DATABASE IF NOT EXISTS offball;
USE offball;
SET parquet.column.index.access=false;
CREATE EXTERNAL TABLE IF NOT EXISTS appearances (
 appearance_id STRING, game_id BIGINT, player_id BIGINT,
 player_club_id BIGINT, player_current_club_id BIGINT, `date` DATE,
 player_name STRING, competition_id STRING, yellow_cards BIGINT,
 red_cards BIGINT, goals BIGINT, assists BIGINT, minutes_played BIGINT
) STORED AS PARQUET LOCATION 'hdfs://namenode:8020/offball/silver/appearances';
CREATE EXTERNAL TABLE IF NOT EXISTS players (
 player_id BIGINT, name STRING, position STRING, sub_position STRING,
 height_in_cm BIGINT, market_value_in_eur BIGINT
) STORED AS PARQUET LOCATION 'hdfs://namenode:8020/offball/silver/players';
CREATE EXTERNAL TABLE IF NOT EXISTS player_valuations (
 player_id BIGINT, `date` DATE, market_value_in_eur BIGINT,
 current_club_name STRING, current_club_id BIGINT, player_club_domestic_competition_id STRING
) STORED AS PARQUET LOCATION 'hdfs://namenode:8020/offball/silver/player_valuations';
CREATE EXTERNAL TABLE IF NOT EXISTS clubs (
 club_id BIGINT, name STRING, domestic_competition_id STRING,
 squad_size BIGINT, average_age DOUBLE
) STORED AS PARQUET LOCATION 'hdfs://namenode:8020/offball/silver/clubs';
CREATE EXTERNAL TABLE IF NOT EXISTS games (
 game_id BIGINT, competition_id STRING, season BIGINT, `date` DATE,
 home_club_id BIGINT, away_club_id BIGINT, home_club_goals BIGINT, away_club_goals BIGINT
) STORED AS PARQUET LOCATION 'hdfs://namenode:8020/offball/silver/games';
SHOW TABLES;
SELECT goals, assists, minutes_played FROM appearances LIMIT 10;
SET hive.execution.engine=mr;
SET mapreduce.framework.name=local;
SELECT COUNT(*) AS total_registros FROM appearances;
SELECT COUNT(*) AS total_registros FROM players;
SELECT COUNT(*) AS total_registros FROM clubs;
SELECT COUNT(*) AS total_registros FROM games;
SELECT COUNT(*) AS total_registros FROM player_valuations;

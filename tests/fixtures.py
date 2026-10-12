"""Synthetic meteorological payloads for tests only."""
import math
from datetime import datetime, timedelta
def fixture(code=2):
    ts=[(datetime(2026,10,11)+timedelta(hours=i)).isoformat(timespec='minutes') for i in range(168)]
    h={'time':ts,'temperature_2m':[round(21+5*math.sin((i%24-7)*math.pi/12),1) for i in range(168)]}
    for key,value in {'apparent_temperature':21,'relative_humidity_2m':65,'precipitation_probability':25,'precipitation':.1,'weather_code':code,'wind_speed_10m':14,'wind_gusts_10m':27,'wind_direction_10m':135,'uv_index':3,'visibility':10000,'is_day':1}.items():h[key]=[value for _ in ts]
    h['is_day']=[int(7<=i%24<19) for i in range(168)]
    dates=[(datetime(2026,10,11)+timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]
    d={'time':dates,'temperature_2m_max':[26,24,23,24,26,27,24],'temperature_2m_min':[16,15,14,13,15,17,16]}
    for k,v in {'precipitation_sum':2.4,'precipitation_probability_max':45,'wind_gusts_10m_max':27,'uv_index_max':5.2,'weather_code':code}.items(): d[k]=[v]*7
    d['sunrise']=[x+'T06:18' for x in dates];d['sunset']=[x+'T19:10' for x in dates]
    return {'latitude':-34.6,'longitude':-58.4,'timezone':'America/Argentina/Buenos_Aires','utc_offset_seconds':-10800,'current':{'time':'2026-10-11T20:00','temperature_2m':22,'apparent_temperature':21,'relative_humidity_2m':65,'weather_code':code,'is_day':0,'wind_speed_10m':14,'wind_gusts_10m':27,'wind_direction_10m':135,'surface_pressure':1014,'cloud_cover':35},'hourly':h,'daily':d}

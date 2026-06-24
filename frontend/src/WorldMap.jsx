import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

// ISO 3166-1 numeric → alpha-2 (world-atlas topology uses numeric IDs)
const N2A2 = {
  4:'AF',8:'AL',12:'DZ',16:'AS',20:'AD',24:'AO',28:'AG',32:'AR',36:'AU',40:'AT',
  44:'BS',48:'BH',50:'BD',51:'AM',52:'BB',56:'BE',64:'BT',68:'BO',70:'BA',72:'BW',
  76:'BR',84:'BZ',90:'SB',96:'BN',100:'BG',104:'MM',108:'BI',116:'KH',120:'CM',
  124:'CA',132:'CV',140:'CF',144:'LK',148:'TD',152:'CL',156:'CN',170:'CO',174:'KM',
  178:'CG',180:'CD',188:'CR',191:'HR',192:'CU',196:'CY',203:'CZ',204:'BJ',208:'DK',
  212:'DM',214:'DO',218:'EC',222:'SV',226:'GQ',231:'ET',232:'ER',233:'EE',242:'FJ',
  246:'FI',250:'FR',266:'GA',268:'GE',270:'GM',276:'DE',288:'GH',296:'KI',300:'GR',
  308:'GD',320:'GT',324:'GN',328:'GY',332:'HT',336:'VA',340:'HN',348:'HU',352:'IS',
  356:'IN',360:'ID',364:'IR',368:'IQ',372:'IE',376:'IL',380:'IT',384:'CI',388:'JM',
  392:'JP',398:'KZ',400:'JO',404:'KE',408:'KP',410:'KR',414:'KW',417:'KG',418:'LA',
  422:'LB',426:'LS',428:'LV',430:'LR',434:'LY',438:'LI',440:'LT',442:'LU',450:'MG',
  454:'MW',458:'MY',462:'MV',466:'ML',470:'MT',478:'MR',480:'MU',484:'MX',492:'MC',
  496:'MN',498:'MD',504:'MA',508:'MZ',516:'NA',520:'NR',524:'NP',528:'NL',548:'VU',
  554:'NZ',558:'NI',562:'NE',566:'NG',578:'NO',583:'FM',585:'PW',586:'PK',591:'PA',
  598:'PG',600:'PY',604:'PE',608:'PH',616:'PL',620:'PT',624:'GW',626:'TL',634:'QA',
  642:'RO',643:'RU',646:'RW',659:'KN',662:'LC',670:'VC',674:'SM',678:'ST',682:'SA',
  686:'SN',688:'RS',694:'SL',703:'SK',704:'VN',706:'SO',710:'ZA',716:'ZW',724:'ES',
  728:'SS',736:'SD',740:'SR',748:'SZ',752:'SE',756:'CH',760:'SY',762:'TJ',764:'TH',
  768:'TG',776:'TO',780:'TT',784:'AE',788:'TN',792:'TR',795:'TM',798:'TV',800:'UG',
  804:'UA',807:'MK',818:'EG',826:'GB',834:'TZ',840:'US',858:'UY',860:'UZ',862:'VE',
  882:'WS',887:'YE',894:'ZM',
};

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

export default function WorldMap({ visitedCountries, visitedPlaces, windowDates }) {
  const windowSet = new Set(windowDates);

  const markers = visitedPlaces
    .map(({ lat, lon, dates }) => ({
      lat,
      lon,
      count: dates.filter(d => windowSet.has(d)).length,
    }))
    .filter(m => m.count > 0);

  return (
    <div className="world-map-wrap">
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 145, center: [0, 15] }}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map(geo => {
              const alpha2 = N2A2[+geo.id];
              const visited = alpha2 ? visitedCountries.has(alpha2) : false;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={visited ? 'rgba(196,35,68,0.65)' : 'rgba(255,255,255,0.07)'}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover: {
                      fill: visited ? 'rgba(196,35,68,0.9)' : 'rgba(255,255,255,0.14)',
                      outline: 'none',
                    },
                    pressed: { outline: 'none' },
                  }}
                />
              );
            })
          }
        </Geographies>
        {markers.map(({ lat, lon, count }, i) => (
          <Marker key={i} coordinates={[lon, lat]}>
            <circle
              r={Math.max(2.5, Math.min(9, Math.sqrt(count) * 1.8))}
              fill="rgba(79,140,255,0.75)"
              stroke="rgba(120,170,255,0.9)"
              strokeWidth={0.8}
            />
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
}
